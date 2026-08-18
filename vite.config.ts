import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Clips are written into the RN app's asset tree so they can be imported /
// bundled directly. figure-pose-app lives one level under the workspace root.
const CLIPS_DIR = resolve(here, '..', 'components', 'stick-figure', 'clips');

const slug = (s: string) =>
 s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clip';

/**
 * Dev-server middleware: POST /save-clip { clip } writes the clip JSON straight
 * into the workspace at components/stick-figure/clips/<slug>.json. This is the
 * "save into this workspace" seam — no native file system, no static server.
 */
function saveClipPlugin(): Plugin {
 return {
 name: 'save-clip',
 configureServer(server) {
 server.middlewares.use('/save-clip', (req, res) => {
 if (req.method !== 'POST') {
 res.statusCode = 405;
 res.end('Method Not Allowed');
 return;
 }
 let body = '';
 req.on('data', (c) => (body += c));
 req.on('end', () => {
 try {
 const { clip } = JSON.parse(body);
 if (!clip || !Array.isArray(clip.frames) || !clip.frames.length) {
 res.statusCode = 400;
 res.end(JSON.stringify({ error: 'invalid clip' }));
 return;
 }
 mkdirSync(CLIPS_DIR, { recursive: true });
 const file = resolve(CLIPS_DIR, `${slug(clip.name || clip.id)}.json`);
 writeFileSync(file, JSON.stringify(clip, null, 2), 'utf8');
 res.setHeader('Content-Type', 'application/json');
 res.end(JSON.stringify({ ok: true, path: file }));
 // eslint-disable-next-line no-console
 console.log(`\n[save-clip] wrote ${file}\n`);
 } catch (err: any) {
 res.statusCode = 500;
 res.end(JSON.stringify({ error: String(err?.message ?? err) }));
 }
 });
 });
 },
 };
}

export default defineConfig({
 base: './',
 plugins: [react(), basicSsl(), saveClipPlugin()],
 server: {
 host: true,
 port: 5173,
 },
});
