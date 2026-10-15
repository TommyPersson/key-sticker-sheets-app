import { defaultLayout } from '../layouts';
import { defaultDimensions } from '../paper';
import type { Sheet, Sticker, StickerSize } from '../types';

/** Sample content, using icons from server/seed/icons (served to Storybook as /icons) */
const CONTENT: Pick<Sticker, 'line1' | 'line2' | 'shortcut' | 'icon' | 'category'>[] = [
  { line1: 'DEBUG', line2: '', shortcut: 'Shift-F9', icon: 'intellij/debug.svg', category: 'Run' },
  { line1: 'RUN', line2: '', shortcut: 'Shift-F10', icon: 'intellij/run.svg', category: 'Run' },
  { line1: 'STEP', line2: 'OVER', shortcut: 'F8', icon: 'intellij/stepOver.svg', category: 'Debugging' },
  { line1: 'STEP', line2: 'INTO', shortcut: 'F7', icon: 'intellij/stepInto.svg', category: 'Debugging' },
  { line1: 'RESUME', line2: '', shortcut: 'F9', icon: 'intellij/resume.svg', category: 'Debugging' },
  { line1: 'BUILD', line2: 'PROJECT', shortcut: 'Ctrl-F9', icon: 'intellij/build.svg', category: 'Build' },
  { line1: 'REFORMAT', line2: 'CODE', shortcut: 'Ctrl-Alt-L', icon: 'intellij/reformatCode.svg', category: 'Editing' },
  { line1: 'COMMIT', line2: '', shortcut: 'Ctrl-K', icon: 'intellij/commit.svg', category: 'VCS' },
  { line1: 'PUSH', line2: '', shortcut: 'Ctrl-Shift-K', icon: 'intellij/push.svg', category: 'VCS' },
  { line1: 'FIND', line2: 'IN FILES', shortcut: 'Ctrl-Shift-F', icon: 'intellij/find.svg', category: '' },
  { line1: 'TERMINAL', line2: '', shortcut: 'Alt-F12', icon: 'intellij/terminal.svg', category: '' },
  { line1: 'BOOKMARK', line2: '', shortcut: 'F11', icon: 'intellij/bookmark.svg', category: '' },
];

/** One sample sticker per content entry, in the given size and layout */
export function sampleStickers(size: StickerSize, layout = defaultLayout(size)): Sticker[] {
  return CONTENT.map((content, i) => ({ ...content, id: `${size}-${i}`, size, layout }));
}

export const byId = (stickers: Sticker[]): Record<string, Sticker> => Object.fromEntries(stickers.map((s) => [s.id, s]));

/** A sheet placing the given stickers, with the default settings for the size */
export function sampleSheet(size: StickerSize, stickers: Sticker[], skip = 0): Sheet {
  return {
    id: `sheet-${size}`,
    name: `Sample ${size} sheet`,
    settings: { size, skip, outlines: false, paper: 'A4', landscape: false, dimensions: defaultDimensions(size) },
    items: stickers.map((s, i) => ({ id: `item-${i}`, stickerId: s.id })),
  };
}
