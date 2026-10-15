import type { SheetDimensions, SheetSettings, StickerSize } from './types';

export interface PaperSize {
  id: string;
  label: string;
  /** Portrait width/height in mm */
  width: number;
  height: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { id: 'A4', label: 'A4 (210 × 297 mm)', width: 210, height: 297 },
  { id: 'A5', label: 'A5 (148 × 210 mm)', width: 148, height: 210 },
  { id: 'A3', label: 'A3 (297 × 420 mm)', width: 297, height: 420 },
  { id: 'Letter', label: 'Letter (8.5 × 11 in)', width: 215.9, height: 279.4 },
  { id: 'Legal', label: 'Legal (8.5 × 14 in)', width: 215.9, height: 355.6 },
];

export const DEFAULT_PAPER = 'A4';

/**
 * Default geometry in mm, matching the PoC. The page margin approximates the browser's default
 * print margin that the PoC relied on. The sticker width is the 1.5U one, see defaultDimensions.
 * Keep in sync with DIMENSIONS and SIZE_WIDTHS in server/src/storage.js.
 */
export const DEFAULT_DIMENSIONS: SheetDimensions = {
  cellWidth: 26,
  cellHeight: 17,
  gapX: 2,
  gapY: 2,
  pageMargin: 10,
  sheetPadding: 10,
  markerInset: 5,
  markerSize: 10,
};

/**
 * Key sizes, smallest first. The default sticker width leaves about 2 mm of the key's 19.05 mm
 * per unit pitch (1.5U keeps the PoC's 26 mm). Keep in sync with SIZE_WIDTHS in server/src/storage.js.
 */
export const SIZES: { id: StickerSize; label: string; width: number }[] = [
  { id: '1u', label: '1U', width: 17 },
  { id: '1.25u', label: '1.25U', width: 21.5 },
  { id: '1.5u', label: '1.5U', width: 26 },
  { id: '1.75u', label: '1.75U', width: 31 },
  { id: '2u', label: '2U', width: 36 },
  { id: '2.25u', label: '2.25U', width: 40.5 },
  { id: '2.75u', label: '2.75U', width: 50 },
];

export const DEFAULT_SIZE: StickerSize = '1.5u';

/** The size with the given id, or the default size for anything else */
export const normalizeSize = (value: unknown): StickerSize =>
  SIZES.find((s) => s.id === value)?.id ?? DEFAULT_SIZE;

/** Default geometry for a sheet of one size: the stickers get the size's width */
export const defaultDimensions = (size: StickerSize): SheetDimensions => ({
  ...DEFAULT_DIMENSIONS,
  cellWidth: SIZES.find((s) => s.id === size)?.width ?? DEFAULT_DIMENSIONS.cellWidth,
});

export const sizeLabel = (size: StickerSize) => SIZES.find((s) => s.id === size)?.label ?? size;

/** Allowed range for each dimension, in mm */
export const DIMENSION_LIMITS: Record<keyof SheetDimensions, { min: number; max: number }> = {
  cellWidth: { min: 5, max: 200 },
  cellHeight: { min: 5, max: 200 },
  gapX: { min: 0, max: 50 },
  gapY: { min: 0, max: 50 },
  pageMargin: { min: 0, max: 50 },
  sheetPadding: { min: 0, max: 50 },
  markerInset: { min: 0, max: 50 },
  markerSize: { min: 0, max: 50 },
};

export const dimensionsOf = (settings: SheetSettings): SheetDimensions => ({
  ...defaultDimensions(settings.size),
  ...settings.dimensions,
});

export function paperSize(settings: SheetSettings) {
  const paper = PAPER_SIZES.find((p) => p.id === settings.paper) ?? PAPER_SIZES[0];
  return settings.landscape ? { ...paper, width: paper.height, height: paper.width } : paper;
}

/** The grid is derived from the paper: as many stickers as fit inside the margin. */
export function gridFor(settings: SheetSettings) {
  const paper = paperSize(settings);
  const d = dimensionsOf(settings);
  const fit = (available: number, cell: number, gap: number) =>
    Math.max(1, Math.floor((available - 2 * d.pageMargin - 2 * d.sheetPadding + gap) / (cell + gap)));
  const columns = fit(paper.width, d.cellWidth, d.gapX);
  const rows = fit(paper.height, d.cellHeight, d.gapY);
  return { columns, rows, perPage: columns * rows };
}

/** Formats mm values without float noise, e.g. 10.16 or 26 */
export const mm = (n: number) => `${+n.toFixed(2)}`;
