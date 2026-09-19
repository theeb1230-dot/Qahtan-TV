import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dns from 'node:dns';
import net from 'node:net';
import { Readable } from 'node:stream';
import { createServer as createViteServer } from 'vite';
import { stremioRouter } from './src/addon/router.js';
import { registry } from './src/providers/index.js';
import { StremioContentType } from './src/types/stremio.js';
import { Logger } from './src/utils/logger.js';

try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const logger = new Logger('Server');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);

function isForbiddenIp(address: string): boolean {
  const ip = address.toLowerCase().split('%')[0];
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') ||
      ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
      ip.startsWith('ff') || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') ||
      ip.startsWith('::ffff:192.168.');
  }
  return true;
}

async function assertSafePublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) throw new Error('Local destinations are blocked');
  const resolved = await dns.promises.lookup(url.hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(r => isForbiddenIp(r.address))) throw new Error('Private or reserved destination is blocked');
  return url;
}

async function safeFetch(raw: string, init: RequestInit, maxRedirects = 3): Promise<globalThis.Response> {
  let current = (await assertSafePublicUrl(raw)).toString();
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafePublicUrl(current);
    const response = await fetch(current, { ...init, redirect: 'manual' });
    if (![301,302,303,307,308].includes(response.status)) return response;
    if (i === maxRedirects) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect missing location');
    current = new URL(location, current).toString();
  }
  throw new Error('Redirect validation failed');
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

  app.get('/api/health', (_req, res) => res.json({ status:'ok', providersCount:registry.getAllProviders().length, uptime:process.uptime() }));

  app.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const streamUrl = String(req.query.url || '');
    if (!streamUrl) return res.status(400).send('Missing url parameter');
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
      res.status(502).send('Failed to proxy stream');
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
      try { const upstream=await safeFetch(target,{headers:{'User-Agent':'Mozilla/5.0 QahtanTV/0.1'},signal:AbortSignal.timeout(10_000)}); const body=await upstream.text(); res.json({url:upstream.url,status:upstream.status,preview:body.slice(0,500)});}
      catch(err){res.status(502).json({error:(err as Error).message});}
    });
  }

  app.use('/',stremioRouter);
  if(!isProduction){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
  else {const dist=path.join(process.cwd(),'dist');app.use(express.static(dist,{index:false}));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>logger.info(`Qahtan TV server listening on port ${PORT}`));
}
startServer().catch(err=>logger.error(`Fatal server startup error: ${err.message}`,err));
