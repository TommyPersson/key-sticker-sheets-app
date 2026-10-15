import { sheetSummary } from '../api';
import { defaultDimensions, normalizeSize } from '../paper';
import type { IconInfo, Sheet, SheetSettings, Sticker } from '../types';

/**
 * An in-memory stand-in for the server's /api, so the whole app runs in Storybook.
 * Sheets and stickers can be edited; icon uploads and changes are not supported.
 */
export interface MockData {
  sheets: Sheet[];
  stickers: Sticker[];
}

/** A few of the seed icons, which Storybook serves at /icons */
const ICONS: IconInfo[] = [
  ...['bookmark', 'build', 'commit', 'debug', 'find', 'push', 'reformatCode', 'resume', 'run', 'stepInto', 'stepOver', 'terminal'].map(
    (name) => ({ path: `intellij/${name}.svg`, folder: 'intellij', name: `${name}.svg` }),
  ),
  ...['play_circle_outline', 'pause_circle_outline', 'skip_next', 'skip_previous', 'lock', 'calculate'].map((name) => ({
    path: `material/${name}_24dp_1F1F1F.svg`,
    folder: 'material',
    name: `${name}_24dp_1F1F1F.svg`,
  })),
];

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Fills in what the server would: default settings for the sheet's size */
const normalizeSettings = (settings: Partial<SheetSettings> = {}): SheetSettings => {
  const size = normalizeSize(settings.size);
  return {
    skip: 0,
    outlines: false,
    paper: 'A4',
    landscape: false,
    ...settings,
    size,
    dimensions: { ...defaultDimensions(size), ...settings.dimensions },
  };
};

/** Replaces window.fetch for /api requests; returns a function that restores it */
export function installMockApi(initial: MockData): () => void {
  // Copies, so stories never share edits
  let sheets: Sheet[] = structuredClone(initial.sheets);
  let stickers: Sticker[] = structuredClone(initial.stickers);
  const original = window.fetch;

  const handle = async (method: string, path: string, body: unknown): Promise<Response> => {
    const [, , resource, id] = path.split('/').map(decodeURIComponent);
    const now = new Date().toISOString();

    if (resource === 'sheets') {
      if (!id && method === 'GET') {
        return json(sheets.map(sheetSummary));
      }
      if (!id && method === 'POST') {
        const input = body as Partial<Sheet>;
        const sheet: Sheet = {
          id: crypto.randomUUID(),
          name: input.name || 'Untitled sheet',
          items: input.items ?? [],
          settings: normalizeSettings(input.settings),
          createdAt: now,
          updatedAt: now,
        };
        sheets.push(sheet);
        return json(sheet, 201);
      }
      const sheet = sheets.find((s) => s.id === id);
      if (!sheet) return json({ error: `Sheet ${id} not found` }, 404);
      if (method === 'GET') return json(sheet);
      if (method === 'PUT') {
        const updated = { ...(body as Sheet), id, updatedAt: now, settings: normalizeSettings((body as Sheet).settings) };
        sheets = sheets.map((s) => (s.id === id ? updated : s));
        return json(updated);
      }
      if (method === 'DELETE') {
        sheets = sheets.filter((s) => s.id !== id);
        return json(null, 204);
      }
    }

    if (resource === 'stickers') {
      if (!id && method === 'GET') {
        return json(stickers.map((s) => ({ ...s, sheets: sheets.filter((sh) => sh.items.some((i) => i.stickerId === s.id)).map((sh) => sh.id) })));
      }
      if (method === 'PUT') {
        const sticker = { ...(body as Sticker), id, updatedAt: now };
        stickers = stickers.some((s) => s.id === id) ? stickers.map((s) => (s.id === id ? sticker : s)) : [...stickers, sticker];
        return json(sticker);
      }
      if (method === 'DELETE') {
        const affected = sheets.filter((s) => s.items.some((i) => i.stickerId === id)).map((s) => s.id);
        sheets = sheets.map((s) => ({ ...s, items: s.items.filter((i) => i.stickerId !== id) }));
        stickers = stickers.filter((s) => s.id !== id);
        return json({ affectedSheets: affected });
      }
    }

    if (resource === 'icons' && method === 'GET' && !id) return json(ICONS);
    if (resource === 'icon-folders' && method === 'GET') return json([...new Set(ICONS.map((i) => i.folder))]);
    if (resource === 'icons' || resource === 'icon-folders') return json({ error: 'Not available in Storybook' }, 501);
    return json({ error: 'Not found' }, 404);
  };

  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (!url.pathname.startsWith('/api/')) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return handle(method, url.pathname, body);
  };
  return () => {
    window.fetch = original;
  };
}
