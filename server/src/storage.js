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
 *   <dataDir>/stickers.json         the global sticker library
 *   <dataDir>/sheets/<id>.json      sheets, referring to library stickers by id
 *   <dataDir>/icons/<folder>/<file>
 */
export class Storage {
  constructor(dataDir, seedDir) {
    this.dataDir = path.resolve(dataDir);
    this.seedDir = seedDir ? path.resolve(seedDir) : null;
    this.sheetsDir = path.join(this.dataDir, 'sheets');
    this.iconsDir = path.join(this.dataDir, 'icons');
    this.libraryFile = path.join(this.dataDir, 'stickers.json');
    this.queue = Promise.resolve();
  }

  /** Runs read-modify-write operations one at a time so concurrent requests can't lose updates. */
  exclusive(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
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
    await this.migrateEmbeddedStickers();
  }

  /**
   * Sheets used to embed their stickers. Moves them into the library (merging identical
   * stickers into one entry) and replaces them with references.
   */
  async migrateEmbeddedStickers() {
    const library = await this.readLibrary();
    const byContent = new Map(library.map((s) => [contentKey(s), s]));
    const migrated = [];
    for (const file of await this.sheetFiles()) {
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      if (Array.isArray(raw.items) || !Array.isArray(raw.stickers)) continue;
      raw.items = raw.stickers.map((embedded) => {
        const sticker = normalizeSticker(embedded);
        const existing = byContent.get(contentKey(sticker));
        if (existing) return { id: crypto.randomUUID(), stickerId: existing.id };
        if (library.some((s) => s.id === sticker.id)) sticker.id = crypto.randomUUID();
        library.push(sticker);
        byContent.set(contentKey(sticker), sticker);
        return { id: crypto.randomUUID(), stickerId: sticker.id };
      });
      delete raw.stickers;
      migrated.push([file, raw]);
    }
    if (migrated.length === 0) return;
    // Library first, so sheets never refer to stickers that don't exist yet
    await writeJsonAtomic(this.libraryFile, library);
    for (const [file, sheet] of migrated) await writeJsonAtomic(file, sheet);
    console.log(`Migrated ${migrated.length} sheet(s) to the sticker library (${library.length} stickers)`);
  }

  // ---------- Sticker library ----------

  async readLibrary() {
    try {
      const data = JSON.parse(await fs.readFile(this.libraryFile, 'utf8'));
      return Array.isArray(data) ? data.map(normalizeSticker) : [];
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  /** All library stickers, each with the ids of the sheets that use it. */
  async listStickers() {
    const [library, sheets] = await Promise.all([this.readLibrary(), this.readAllSheets()]);
    const usage = new Map();
    for (const sheet of sheets) {
      for (const item of sheet.items) {
        const ids = usage.get(item.stickerId) ?? new Set();
        ids.add(sheet.id);
        usage.set(item.stickerId, ids);
      }
    }
    return library.map((s) => ({ ...s, sheets: [...(usage.get(s.id) ?? [])] }));
  }

  /** Creates or replaces a library sticker. */
  saveSticker(id, input) {
    if (!ID_PATTERN.test(id)) throw new ValidationError(`Invalid sticker id: ${id}`);
    return this.exclusive(async () => {
      const library = await this.readLibrary();
      const now = new Date().toISOString();
      const index = library.findIndex((s) => s.id === id);
      const sticker = normalizeSticker({
        ...input,
        id,
        createdAt: index >= 0 ? library[index].createdAt : now,
        updatedAt: now,
      });
      if (index >= 0) library[index] = sticker;
      else library.push(sticker);
      await writeJsonAtomic(this.libraryFile, library);
      return sticker;
    });
  }

  /** Deletes a library sticker and removes it from every sheet. Returns the ids of the affected sheets. */
  deleteSticker(id) {
    return this.exclusive(async () => {
      const library = await this.readLibrary();
      if (!library.some((s) => s.id === id)) throw new NotFoundError(`Sticker ${id} not found`);
      const affected = [];
      for (const sheet of await this.readAllSheets()) {
        const items = sheet.items.filter((i) => i.stickerId !== id);
        if (items.length === sheet.items.length) continue;
        await writeJsonAtomic(this.sheetFile(sheet.id), { ...sheet, items, updatedAt: new Date().toISOString() });
        affected.push(sheet.id);
      }
      await writeJsonAtomic(
        this.libraryFile,
        library.filter((s) => s.id !== id),
      );
      return { affectedSheets: affected };
    });
  }

  // ---------- Sheets ----------

  sheetFile(id) {
    if (!ID_PATTERN.test(id)) throw new ValidationError(`Invalid sheet id: ${id}`);
    return path.join(this.sheetsDir, `${id}.json`);
  }

  async sheetFiles() {
    const files = await fs.readdir(this.sheetsDir);
    return files.filter((f) => f.endsWith('.json')).map((f) => path.join(this.sheetsDir, f));
  }

  async readAllSheets() {
    const sheets = await Promise.all(
      (await this.sheetFiles()).map(async (file) => {
        try {
          return normalizeSheet(JSON.parse(await fs.readFile(file, 'utf8')));
        } catch (e) {
          console.warn(`Skipping unreadable sheet ${file}: ${e.message}`);
          return null;
        }
      }),
    );
    return sheets.filter(Boolean);
  }

  async listSheets() {
    const sheets = await this.readAllSheets();
    return sheets
      .map((s) => ({ id: s.id, name: s.name, stickerCount: s.items.length, updatedAt: s.updatedAt }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSheet(id) {
    try {
      // Normalizing fills in settings added after the file was written
      return normalizeSheet(JSON.parse(await fs.readFile(this.sheetFile(id), 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError(`Sheet ${id} not found`);
      throw e;
    }
  }

  createSheet(input) {
    return this.exclusive(async () => {
      const now = new Date().toISOString();
      const sheet = normalizeSheet({ ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      await writeJsonAtomic(this.sheetFile(sheet.id), sheet);
      return sheet;
    });
  }

  updateSheet(id, input) {
    return this.exclusive(async () => {
      const existing = await this.getSheet(id);
      const sheet = normalizeSheet({
        ...input,
        id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      await writeJsonAtomic(this.sheetFile(id), sheet);
      return sheet;
    });
  }

  deleteSheet(id) {
    return this.exclusive(async () => {
      try {
        await fs.unlink(this.sheetFile(id));
      } catch (e) {
        if (e.code === 'ENOENT') throw new NotFoundError(`Sheet ${id} not found`);
        throw e;
      }
    });
  }

  // ---------- Icons ----------

  /** Icon folders, including empty ones */
  async listIconFolders() {
    const entries = await fs.readdir(this.iconsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  }

  iconFolder(folder) {
    if (!SEGMENT_PATTERN.test(folder ?? '')) throw new ValidationError('Invalid folder name');
    return path.join(this.iconsDir, folder);
  }

  async createIconFolder(folder) {
    const dir = this.iconFolder(folder);
    try {
      await fs.mkdir(dir);
    } catch (e) {
      if (e.code === 'EEXIST') throw new ValidationError(`Folder "${folder}" already exists`);
      throw e;
    }
    return folder;
  }

  /** Deletes an empty folder. Folders with icons must be emptied first. */
  async deleteIconFolder(folder) {
    const dir = this.iconFolder(folder);
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError('Folder not found');
      throw e;
    }
    if (entries.length > 0) throw new ValidationError(`Folder "${folder}" is not empty`);
    await fs.rmdir(dir);
  }

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

  /**
   * Renames an icon and/or moves it to another existing folder, keeping its file type,
   * and updates the library stickers using it. Sheets refer to stickers, not icons, so they need no changes.
   */
  renameIcon(folder, name, newName = name, newFolder = folder) {
    const from = this.iconFile(folder, name);
    const to = this.iconFile(newFolder, newName);
    if (path.extname(name).toLowerCase() !== path.extname(newName).toLowerCase()) {
      throw new ValidationError('Renaming cannot change the file type');
    }
    return this.exclusive(async () => {
      try {
        await fs.access(from);
      } catch {
        throw new NotFoundError('Icon not found');
      }
      try {
        await fs.access(path.dirname(to));
      } catch {
        throw new NotFoundError(`Folder "${newFolder}" not found`);
      }
      if (to !== from) {
        try {
          await fs.access(to);
          throw new ValidationError(`An icon named "${newName}" already exists in ${newFolder}`);
        } catch (e) {
          if (e instanceof ValidationError) throw e;
        }
        await fs.rename(from, to);
      }
      const oldPath = `${folder}/${name}`;
      const icon = { path: `${newFolder}/${newName}`, folder: newFolder, name: newName };
      const library = await this.readLibrary();
      const now = new Date().toISOString();
      let updatedStickers = 0;
      const updated = library.map((s) => {
        if (s.icon !== oldPath) return s;
        updatedStickers++;
        return { ...s, icon: icon.path, updatedAt: now };
      });
      if (updatedStickers > 0) await writeJsonAtomic(this.libraryFile, updated);
      return { icon, updatedStickers };
    });
  }

  async deleteIcon(folder, name) {
    const file = this.iconFile(folder, name);
    try {
      await fs.unlink(file);
    } catch (e) {
      if (e.code === 'ENOENT') throw new NotFoundError('Icon not found');
      throw e;
    }
  }
}

function str(value, max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

const validId = (id) => (typeof id === 'string' && ID_PATTERN.test(id) ? id : null);

function normalizeSticker(input) {
  return {
    id: validId(input?.id) ?? crypto.randomUUID(),
    line1: str(input?.line1),
    line2: str(input?.line2),
    shortcut: str(input?.shortcut),
    icon: str(input?.icon, 300),
    category: str(input?.category, 60).trim(),
    createdAt: str(input?.createdAt, 40) || undefined,
    updatedAt: str(input?.updatedAt, 40) || undefined,
  };
}

const contentKey = (s) => JSON.stringify([s.line1, s.line2, s.shortcut, s.icon]);

function normalizeSheet(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('Sheet must be an object');
  const items = Array.isArray(input.items) ? input.items : [];
  return {
    id: input.id,
    name: str(input.name, 100).trim() || 'Untitled sheet',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    settings: normalizeSettings(input.settings ?? {}),
    // Each item places a library sticker on the sheet; a sticker may be placed several times
    items: items
      .filter((i) => validId(i?.stickerId))
      .map((i) => ({ id: validId(i.id) ?? crypto.randomUUID(), stickerId: i.stickerId })),
  };
}

const PAPER_SIZES = new Set(['A4', 'A5', 'A3', 'Letter', 'Legal']);

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.max(min, Math.min(max, n));
}

// Defaults (mm) and limits, keep in sync with DEFAULT_DIMENSIONS/DIMENSION_LIMITS in client/src/paper.ts
const DIMENSIONS = {
  cellWidth: [26, 5, 200],
  cellHeight: [17, 5, 200],
  gapX: [2, 0, 50],
  gapY: [2, 0, 50],
  pageMargin: [10, 0, 50],
  sheetPadding: [10, 0, 50],
  markerInset: [5, 0, 50],
  markerSize: [10, 0, 50],
};

function normalizeDimensions(input) {
  const dimensions = {};
  for (const [key, [fallback, min, max]] of Object.entries(DIMENSIONS)) {
    const n = Number(input?.[key]);
    dimensions[key] = Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 100) / 100)) : fallback;
  }
  return dimensions;
}

function normalizeSettings(settings) {
  return {
    dimensions: normalizeDimensions(settings.dimensions),
    paper: PAPER_SIZES.has(settings.paper) ? settings.paper : 'A4',
    landscape: Boolean(settings.landscape),
    // The page capacity depends on the paper and is enforced by the client
    skip: clampInt(settings.skip, 0, 999, 0),
    outlines: Boolean(settings.outlines),
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
