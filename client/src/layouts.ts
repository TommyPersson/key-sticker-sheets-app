import { SIZES } from './paper';
import type { Sticker, StickerSize } from './types';

/**
 * Sticker layouts: where the three components (text, icon, shortcut) sit on a sticker.
 * The components themselves are fixed in look and size; a layout only places them.
 */

/** The text block (lines 1 and 2), the icon and the shortcut */
export type StickerComponent = 'text' | 'icon' | 'shortcut';

/** Nine anchor points inside the sticker's 2 mm padding */
export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

/** Components sharing an anchor, stacked in order (top to bottom, or left to right when `row`) */
export interface LayoutArea {
  anchor: Anchor;
  components: StickerComponent[];
  row?: boolean;
  /** Keeps the area above the shortcut line, e.g. to centre it in that space; ignored when there is no shortcut */
  aboveShortcut?: boolean;
  /** Keeps the area below a top-anchored icon, e.g. to centre it in that space; ignored when there is no icon */
  belowIcon?: boolean;
}

export interface StickerLayout {
  id: string;
  name: string;
  /** Key size the layout is made for */
  size: StickerSize;
  /** Each component appears in at most one area; components left out are not shown */
  areas: LayoutArea[];
  /** Areas used instead when the sticker has no shortcut */
  withoutShortcut?: LayoutArea[];
  /** Icon size in mm, scaled to fit; by default icons are at most 16px (about 4.2 mm) */
  iconSize?: number;
}

/** The arrangements offered for every size */
const ARRANGEMENTS: Omit<StickerLayout, 'size'>[] = [
  {
    id: 'classic',
    name: 'Classic',
    areas: [
      { anchor: 'top-left', components: ['text'] },
      { anchor: 'top-right', components: ['icon'] },
      { anchor: 'bottom-left', components: ['shortcut'] },
    ],
  },
  {
    id: 'centered-text',
    name: 'Centered text',
    areas: [
      // Centred in the space above the shortcut, which balances better than the sticker's centre
      { anchor: 'center', components: ['text'], aboveShortcut: true },
      { anchor: 'bottom', components: ['shortcut'] },
    ],
  },
  {
    id: 'centered-icon',
    name: 'Centered icon',
    areas: [
      { anchor: 'center', components: ['icon'], aboveShortcut: true },
      { anchor: 'bottom', components: ['shortcut'] },
    ],
  },
  // Centered icon, with the icon as large as fits above the shortcut (stickers are 17 mm tall in every size)
  {
    id: 'large-icon',
    name: 'Large icon',
    iconSize: 8,
    areas: [
      { anchor: 'center', components: ['icon'], aboveShortcut: true },
      { anchor: 'bottom', components: ['shortcut'] },
    ],
  },
];

/** A size's id for an arrangement. 1.5U ids have no prefix, since 1.5U was the only size at first. */
const layoutId = (size: StickerSize, arrangement: string) => (size === '1.5u' ? arrangement : `${size}-${arrangement}`);

/** Every layout for every size */
export const LAYOUTS: StickerLayout[] = [
  ...SIZES.flatMap(({ id: size }) => ARRANGEMENTS.map((a) => ({ ...a, id: layoutId(size, a.id), size }))),
  // The square 1U sticker has room to stack the components; one line of text fits between icon and shortcut
  {
    id: '1u-icon-above',
    name: 'Icon above text',
    size: '1u',
    areas: [
      { anchor: 'top', components: ['icon'] },
      { anchor: 'center', components: ['text'] },
      { anchor: 'bottom', components: ['shortcut'] },
    ],
    // The text moves down into the shortcut's space, centred below the icon, leaving room for two lines
    withoutShortcut: [
      { anchor: 'top', components: ['icon'] },
      { anchor: 'center', components: ['text'], belowIcon: true },
    ],
  },
];

const byId = new Map(LAYOUTS.map((l) => [l.id, l]));

/** The layouts offered for stickers of a size */
export const layoutsFor = (size: StickerSize) => LAYOUTS.filter((l) => l.size === size);

/** Classic, for the size */
export const defaultLayout = (size: StickerSize) => layoutId(size, 'classic');

/** The sticker's layout, falling back to its size's default for unknown ids and layouts of another size */
export function layoutOf(sticker: Pick<Sticker, 'layout' | 'size'>): StickerLayout {
  const layout = byId.get(sticker.layout);
  return layout?.size === sticker.size ? layout : byId.get(defaultLayout(sticker.size))!;
}
