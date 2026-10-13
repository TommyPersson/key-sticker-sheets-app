/** A sticker in the global library */
export interface Sticker {
  id: string;
  line1: string;
  line2: string;
  shortcut: string;
  /** Icon path relative to the icon store, e.g. "intellij/debug.svg". Empty for no icon. */
  icon: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Library sticker as listed by the server, with the ids of the sheets using it */
export interface LibrarySticker extends Sticker {
  sheets: string[];
}

/** A placement of a library sticker on a sheet */
export interface SheetItem {
  id: string;
  stickerId: string;
}

export interface SheetSettings {
  /** Number of sticker slots to leave empty at the start of the first page (partially used paper). */
  skip: number;
  /** Print thin outlines around each sticker. */
  outlines: boolean;
  /** Paper size id, see paper.ts */
  paper: string;
  landscape: boolean;
  dimensions: SheetDimensions;
}

/** Sheet geometry, all in mm */
export interface SheetDimensions {
  cellWidth: number;
  cellHeight: number;
  /** Horizontal gap between stickers */
  gapX: number;
  /** Vertical gap between stickers */
  gapY: number;
  /** Paper edge to sheet edge */
  pageMargin: number;
  /** Sheet edge to the first sticker (the registration markers sit in this area) */
  sheetPadding: number;
  /** Sheet edge to the registration markers */
  markerInset: number;
  /** Length of each registration marker arm */
  markerSize: number;
}

export interface Sheet {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  settings: SheetSettings;
  items: SheetItem[];
}

export interface SheetSummary {
  id: string;
  name: string;
  stickerCount: number;
  updatedAt?: string;
}

export interface IconInfo {
  path: string;
  folder: string;
  name: string;
}
