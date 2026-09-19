import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dns from 'node:dns';
import { Readable } from 'node:stream';
import { createServer as createViteServer } from 'vite';
import { stremioRouter } from './src/addon/router.js';
import { registry } from './src/providers/index.js';
import { StremioContentType } from './src/types/stremio.js';
import { Logger } from './src/utils/logger.js';
import { safeFetch } from './src/security/network.js';
import { readBoundedTextPreview } from './src/security/response.js';

try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const logger = new Logger('Server');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const STREAM_PROXY_MAX_CONCURRENT = Math.max(1, Number.parseInt(process.env.STREAM_PROXY_MAX_CONCURRENT || '24', 10) || 24);
const STREAM_PROXY_RATE_WINDOW_MS = Math.max(1_000, Number.parseInt(process.env.STREAM_PROXY_RATE_WINDOW_MS || '60000', 10) || 60_000);
const STREAM_PROXY_RATE_MAX = Math.max(1, Number.parseInt(process.env.STREAM_PROXY_RATE_MAX || '120', 10) || 120);
const DEBUG_FETCH_PREVIEW_MAX_BYTES = Math.min(256 * 1024, Math.max(1024, Number.parseInt(process.env.DEBUG_FETCH_PREVIEW_MAX_BYTES || '65536', 10) || 65536));
let activeProxyRequests = 0;
const proxyRate = new Map<string, { count: number; resetAt: number }>();

function allowProxyRequest(req: Request): boolean {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const existing = proxyRate.get(key);
  if (!existing || existing.resetAt <= now) {
    proxyRate.set(key, { count: 1, resetAt: now + STREAM_PROXY_RATE_WINDOW_MS });
    return true;
  }
  existing.count += 1;
  return existing.count <= STREAM_PROXY_RATE_MAX;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, cb) {
      if (!origin || !isProduction || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  app.get('/api/health', (_req, res) => res.json({ status:'ok', providersCount:registry.getAllProviders().length, uptime:process.uptime(), proxy:{active:activeProxyRequests,maxConcurrent:STREAM_PROXY_MAX_CONCURRENT} }));

  app.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const streamUrl = String(req.query.url || '');
    if (!streamUrl) return res.status(400).send('Missing url parameter');
    if (!allowProxyRequest(req)) return res.status(429).setHeader('Retry-After', String(Math.ceil(STREAM_PROXY_RATE_WINDOW_MS / 1000))).send('Rate limit exceeded');
    if (activeProxyRequests >= STREAM_PROXY_MAX_CONCURRENT) return res.status(503).setHeader('Retry-After', '1').send('Stream proxy busy');
    activeProxyRequests += 1;
    let released = false;
    const release = () => { if (!released) { released = true; activeProxyRequests = Math.max(0, activeProxyRequests - 1); } };
    res.once('close', release);
    res.once('finish', release);
    try {
      const headers: Record<string,string> = {
        'User-Agent': String(req.query.userAgent || 'Mozilla/5.0 QahtanTV/0.1'),
        Accept: '*/*',
      };
      if (req.headers.range) headers.Range = req.headers.range;
      if (req.query.referer) headers.Referer = String(req.query.referer);
      if (req.query.origin) headers.Origin = String(req.query.origin);

      const upstream = await safeFetch(streamUrl, { headers, signal: AbortSignal.timeout(15_000) });
      res.status(upstream.status);
      for (const h of ['content-type','content-length','content-range','accept-ranges','cache-control','etag','last-modified']) {
        const v = upstream.headers.get(h); if (v) res.setHeader(h, v);
      }
      if (!upstream.body) return res.end();
      Readable.fromWeb(upstream.body as any).on('error', err => res.destroy(err as Error)).pipe(res);
    } catch (err) {
      logger.error('Stream proxy request failed', err);
      if (!res.headersSent) res.status(502).send('Failed to proxy stream');
      else res.destroy(err as Error);
    } finally {
      if (!res.writableEnded && res.destroyed) release();
    }
  });

  app.get('/api/providers', (_req, res) => res.json({ providers: registry.getAllProviders().map(p => ({id:p.id,name:p.name,lang:p.lang,mainUrl:p.mainUrl,supportedTypes:p.supportedTypes})) }));

  app.get('/api/search', async (req,res) => {
    const q=String(req.query.q||''); const providerId=req.query.provider as string;
    if(!q) return res.json({results:[]});
    try { if(providerId){const p=registry.getProvider(providerId); if(!p)return res.status(404).json({error:'Provider not found'}); return res.json({results:await p.search(q)});}
      res.json({results:await registry.searchAll(q)}); } catch(err){res.status(500).json({error:(err as Error).message});}
  });
  app.get('/api/catalog', async (req,res) => {
    const type=(req.query.type as StremioContentType)||'movie'; const providerId=req.query.provider as string; const page=parseInt(String(req.query.page||'1'),10);
    try { if(providerId){const p=registry.getProvider(providerId);if(!p)return res.status(404).json({error:'Provider not found'});return res.json({results:await p.getCatalog(type,page)});}
      res.json({results:await registry.getCatalog(type,page)}); }catch(err){res.status(500).json({error:(err as Error).message});}
  });
  app.get('/api/meta',async(req,res)=>{const id=req.query.id as string;const type=(req.query.type as StremioContentType)||'movie';if(!id)return res.status(400).json({error:'Missing id parameter'});try{res.json({meta:await registry.getMeta(id,type)});}catch(err){res.status(500).json({error:(err as Error).message});}});
  app.get('/api/streams',async(req,res)=>{const id=req.query.id as string;const type=(req.query.type as StremioContentType)||'movie';if(!id)return res.status(400).json({error:'Missing id parameter'});try{res.json({streams:await registry.getStreams(id,type,req.query.episodeId as string|undefined)});}catch(err){res.status(500).json({error:(err as Error).message});}});

  if (!isProduction) {
    app.get('/api/debug-fetch', async (req,res) => {
      const target=String(req.query.url||''); if(!target)return res.status(400).json({error:'Missing url query parameter'});
      try {
        const upstream=await safeFetch(target,{headers:{'User-Agent':'Mozilla/5.0 QahtanTV/0.1'},signal:AbortSignal.timeout(10_000)});
        const { preview, truncated } = await readBoundedTextPreview(upstream, DEBUG_FETCH_PREVIEW_MAX_BYTES);
        res.json({url:upstream.url,status:upstream.status,preview,truncated,previewBytesLimit:DEBUG_FETCH_PREVIEW_MAX_BYTES});
      } catch(err){res.status(502).json({error:(err as Error).message});}
    });
  }

  app.use('/',stremioRouter);
  if(!isProduction){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
  else {const dist=path.join(process.cwd(),'dist');app.use(express.static(dist,{index:false}));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>logger.info(`Qahtan TV server listening on port ${PORT}`));
}
startServer().catch(err=>logger.error(`Fatal server startup error: ${err.message}`,err));
