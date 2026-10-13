import type { Sheet, SheetSettings, Sticker } from './types';

export type StickerContent = Pick<Sticker, 'line1' | 'line2' | 'shortcut' | 'icon'>;

/** Self-contained sheet file: stickers are embedded, so it can be imported into another library. */
export interface SheetFile {
  name: string;
  settings: SheetSettings;
  stickers: StickerContent[];
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Accepts the PoC "icons/folder/file.svg" form as well as plain "folder/file.svg". */
const iconPath = (v: unknown) => text(v).replace(/^\/?icons\//, '');

export const contentKey = (s: StickerContent) => JSON.stringify([s.line1, s.line2, s.shortcut, s.icon]);

export function toSheetFile(sheet: Sheet, stickers: Record<string, Sticker>): SheetFile {
  return {
    name: sheet.name,
    settings: sheet.settings,
    stickers: sheet.items
      .map((i) => stickers[i.stickerId])
      .filter(Boolean)
      .map(({ line1, line2, shortcut, icon }) => ({ line1, line2, shortcut, icon })),
  };
}

/**
 * Parses an imported JSON file. Supports:
 *  - a sheet exported from this app ({ name, settings, stickers: [...] })
 *  - the PoC data format (an array of { line1, line2, shortcut, icon })
 */
export function parseImport(json: string, fallbackName: string): SheetFile {
  const data = JSON.parse(json);
  const rawStickers: unknown[] | undefined = Array.isArray(data) ? data : data?.stickers;
  if (!Array.isArray(rawStickers)) throw new Error('Expected a sheet object or an array of stickers');

  return {
    name: text(data?.name) || fallbackName,
    // Passed through as-is; the server validates settings and fills in defaults
    settings: { ...data?.settings } as SheetSettings,
    stickers: rawStickers.map((raw) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      return { line1: text(s.line1), line2: text(s.line2), shortcut: text(s.shortcut), icon: iconPath(s.icon) };
    }),
  };
}
