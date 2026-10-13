import type { Sheet, Sticker } from './types';

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Accepts the PoC "icons/folder/file.svg" form as well as plain "folder/file.svg". */
const iconPath = (v: unknown) => text(v).replace(/^\/?icons\//, '');

/**
 * Parses an imported JSON file. Supports:
 *  - a sheet exported from this app ({ name, settings, stickers: [...] })
 *  - the PoC data format (an array of { line1, line2, shortcut, icon })
 */
export function parseImport(json: string, fallbackName: string): Partial<Sheet> {
  const data = JSON.parse(json);
  const rawStickers: unknown[] | undefined = Array.isArray(data) ? data : data?.stickers;
  if (!Array.isArray(rawStickers)) throw new Error('Expected a sheet object or an array of stickers');

  const stickers: Sticker[] = rawStickers.map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    return {
      id: crypto.randomUUID(),
      line1: text(s.line1),
      line2: text(s.line2),
      shortcut: text(s.shortcut),
      icon: iconPath(s.icon),
    };
  });

  return {
    name: text(data?.name) || fallbackName,
    settings: { skip: Number(data?.settings?.skip) || 0, outlines: Boolean(data?.settings?.outlines) },
    stickers,
  };
}
