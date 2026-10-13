import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ICON_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/;

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

/**
 * File based storage rooted at a data directory (typically a docker volume):
 *   <dataDir>/sheets/<id>.json
 *   <dataDir>/icons/<folder>/<file>
 */
export class Storage {
  constructor(dataDir, seedDir) {
    this.dataDir = path.resolve(dataDir);
    this.seedDir = seedDir ? path.resolve(seedDir) : null;
    this.sheetsDir = path.join(this.dataDir, 'sheets');
    this.iconsDir = path.join(this.dataDir, 'icons');
  }

  /** Creates the directory layout and copies seed data on first start. */
  async init() {
    for (const [dir, name] of [[this.sheetsDir, 'sheets'], [this.iconsDir, 'icons']]) {
      const exists = await pathExists(dir);
      await fs.mkdir(dir, { recursive: true });
      const seed = this.seedDir && path.join(this.seedDir, name);
      if (!exists && seed && (await pathExists(seed))) {
        await fs.cp(seed, dir, { recursive: true });
        console.log(`Seeded ${dir} from ${seed}`);
      }
    }
  }

  // ---------- Sheets ----------

  sheetFile(id) {
    if (!ID_PATTERN.test(id)) throw new ValidationError(`Invalid sheet id: ${id}`);
    return path.join(this.sheetsDir, `${id}.json`);
  }

  async listSheets() {
    const files = (await fs.readdir(this.sheetsDir)).filter((f) => f.endsWith('.json'));
    const sheets = await Promise.all(
      files.map(async (f) => {
        try {
          const sheet = JSON.parse(await fs.readFile(path.join(this.sheetsDir, f), 'utf8'));
          return {
            id: sheet.id,
            name: sheet.name,
            stickerCount: sheet.stickers?.length ?? 0,
            updatedAt: sheet.updatedAt,
          };
        } catch (e) {
          console.warn(`Skipping unreadable sheet ${f}: ${e.message}`);
          return null;
        }
      }),
    );
    return sheets.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSheet(id) {
    try {
      return JSON.parse(await fs.readFile(this.sheetFile(id), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError(`Sheet ${id} not found`);
      throw e;
    }
  }

  async createSheet(input) {
    const now = new Date().toISOString();
    const sheet = normalizeSheet({ ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    await writeJsonAtomic(this.sheetFile(sheet.id), sheet);
    return sheet;
  }

  async updateSheet(id, input) {
    const existing = await this.getSheet(id);
    const sheet = normalizeSheet({
      ...input,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    await writeJsonAtomic(this.sheetFile(id), sheet);
    return sheet;
  }

  async deleteSheet(id) {
    try {
      await fs.unlink(this.sheetFile(id));
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError(`Sheet ${id} not found`);
      throw e;
    }
  }

  // ---------- Icons ----------

  async listIcons() {
    const icons = [];
    const entries = await fs.readdir(this.iconsDir, { withFileTypes: true });
    for (const folder of entries.filter((e) => e.isDirectory())) {
      const files = await fs.readdir(path.join(this.iconsDir, folder.name), { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && ICON_EXTENSIONS.has(path.extname(file.name).toLowerCase())) {
          icons.push({ path: `${folder.name}/${file.name}`, folder: folder.name, name: file.name });
        }
      }
    }
    return icons.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Resolves "<folder>/<file>" to an absolute path inside the icons directory. */
  iconFile(folder, name) {
    if (!SEGMENT_PATTERN.test(folder ?? '') || !SEGMENT_PATTERN.test(name ?? '')) {
      throw new ValidationError('Invalid icon folder or file name');
    }
    if (!ICON_EXTENSIONS.has(path.extname(name).toLowerCase())) {
      throw new ValidationError(`Unsupported icon type. Allowed: ${[...ICON_EXTENSIONS].join(', ')}`);
    }
    return path.join(this.iconsDir, folder, name);
  }

  async saveIcon(folder, name, data) {
    const file = this.iconFile(folder, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return { path: `${folder}/${name}`, folder, name };
  }

  async deleteIcon(folder, name) {
    const file = this.iconFile(folder, name);
    try {
      await fs.unlink(file);
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError('Icon not found');
      throw e;
    }
    // Remove the folder when it becomes empty
    const remaining = await fs.readdir(path.dirname(file));
    if (remaining.length === 0) await fs.rmdir(path.dirname(file));
  }
}

function str(value, max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function normalizeSheet(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('Sheet must be an object');
  const stickers = Array.isArray(input.stickers) ? input.stickers : [];
  const settings = input.settings ?? {};
  return {
    id: input.id,
    name: str(input.name, 100).trim() || 'Untitled sheet',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    settings: {
      skip: Math.max(0, Math.min(49, Number.parseInt(settings.skip, 10) || 0)),
      outlines: Boolean(settings.outlines),
    },
    stickers: stickers.map((s) => ({
      id: ID_PATTERN.test(s?.id ?? '') ? s.id : crypto.randomUUID(),
      line1: str(s?.line1),
      line2: str(s?.line2),
      shortcut: str(s?.shortcut),
      icon: str(s?.icon, 300),
    })),
  };
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
