import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { NotFoundError, Storage, ValidationError } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = process.env.DATA_DIR ?? path.join(here, '..', 'data');
const SEED_DIR = process.env.SEED_DIR ?? path.join(here, '..', 'seed');
const PUBLIC_DIR = process.env.PUBLIC_DIR ?? path.join(here, '..', 'public');

const storage = new Storage(DATA_DIR, SEED_DIR);
await storage.init();

const app = express();
app.disable('x-powered-by');

const api = express.Router();
api.use(express.json({ limit: '5mb' }));

api.get('/health', (req, res) => res.json({ ok: true }));

api.get('/sheets', async (req, res) => res.json(await storage.listSheets()));
api.post('/sheets', async (req, res) => res.status(201).json(await storage.createSheet(req.body)));
api.get('/sheets/:id', async (req, res) => res.json(await storage.getSheet(req.params.id)));
api.put('/sheets/:id', async (req, res) => res.json(await storage.updateSheet(req.params.id, req.body)));
api.delete('/sheets/:id', async (req, res) => {
  await storage.deleteSheet(req.params.id);
  res.status(204).end();
});

api.get('/icons', async (req, res) => res.json(await storage.listIcons()));
api.put(
  '/icons/:folder/:name',
  express.raw({ type: () => true, limit: '2mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('Empty upload');
    res.status(201).json(await storage.saveIcon(req.params.folder, req.params.name, req.body));
  },
);
api.delete('/icons/:folder/:name', async (req, res) => {
  await storage.deleteIcon(req.params.folder, req.params.name);
  res.status(204).end();
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('/api', api);

// Uploaded icons are user content: never let an SVG run scripts on our origin.
app.use(
  '/icons',
  (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(storage.iconsDir, { fallthrough: false, maxAge: '1h' }),
);

// Built client (production / container)
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get(/.*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Key sticker sheets listening on http://localhost:${PORT} (data: ${storage.dataDir})`);
});
