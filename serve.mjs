// A tiny static server for the 3D dialogue videos (ES modules do not load from file://), plus the places the pages post their pictures to.
//   node serve.mjs [port]        then open http://localhost:5173/web/episode.html?ep=<slug>   (a click starts the preview with sound)
//   POST /save?name=x.png                      -> out/shots/x.png                    (a still)
//   POST /frame?ep=<slug>&n=12                 -> out/<slug>/frames/f_0012.png       (a frame of a render)
//   POST /done?ep=<slug>&from=0&to=639&sec=9   -> out/<slug>/frames/done_0_639.txt   (a chunk of a render has finished)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 5173;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const safe = (s) => path.basename(String(s || '')).replace(/[^A-Za-z0-9._-]/g, '_');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ep = safe(u.searchParams.get('ep'));
      let file;
      if (u.pathname === '/save') file = path.join(root, 'out', 'shots', safe(u.searchParams.get('name') || 'shot.png'));
      else if (u.pathname === '/frame') file = path.join(root, 'out', ep, 'frames', 'f_' + String(Number(u.searchParams.get('n'))).padStart(4, '0') + '.png');
      else if (u.pathname === '/done') file = path.join(root, 'out', ep, 'frames', `done_${Number(u.searchParams.get('from'))}_${Number(u.searchParams.get('to'))}.txt`);
      if (!file) { res.writeHead(404); return res.end('no such route'); }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, u.pathname === '/done' ? `${u.searchParams.get('sec')} s` : body);
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  if (u.pathname === '/__root') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(root); }   // lets the tools check this server really serves THIS kit
  if (u.pathname === '/') { res.writeHead(302, { Location: '/web/episode.html' }); return res.end(); }
  const file = path.join(root, decodeURIComponent(u.pathname));
  const inOut = file.includes(path.sep + 'out' + path.sep);
  if (!file.startsWith(root) || inOut || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Video 3D: http://localhost:${port}/web/episode.html?ep=<slug>`));
