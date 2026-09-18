import { StremioManifest } from '../types/stremio.js';

export const manifest: StremioManifest = {
  id: 'tv.qahtan.addon',
  version: '0.1.0',
  name: 'قحطان TV (Qahtan TV)',
  description: 'Arabic Movies, Series, Anime, Turkish Drama and Live TV through the Qahtan TV provider engine.',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series', 'anime', 'channel', 'tv'],
  idPrefixes: ['akwam:','faselhd:','arabseed:','wecima:','anime4up:','syrialive:','yacinetv:','witanime:','3isk:','egydead:'],
  catalogs: [
    { type:'movie', id:'qahtan_movies', name:'قحطان TV — الأفلام', extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}] },
    { type:'series', id:'qahtan_series', name:'قحطان TV — المسلسلات', extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}] },
    { type:'anime', id:'qahtan_anime', name:'قحطان TV — الأنمي', extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}] },
    { type:'tv', id:'qahtan_tv', name:'قحطان TV — البث المباشر', extra:[{name:'search',isRequired:false}] }
  ],
  behaviorHints: { configurable:false, configurationRequired:false },
};
