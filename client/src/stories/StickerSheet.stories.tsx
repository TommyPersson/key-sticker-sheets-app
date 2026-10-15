import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrintedPage, StickerSheetEditor, paginate } from '../components/StickerSheet';
import type { Sheet, Sticker, StickerSize } from '../types';
import { byId, sampleSheet, sampleStickers } from './fixtures';

interface Args {
  size: StickerSize;
  /** Leading slots left empty */
  skip: number;
  outlines: boolean;
  landscape: boolean;
  /** Number of sample stickers placed (at most 12) */
  count: number;
}

const sheetOf = (args: Args): { sheet: Sheet; stickers: Record<string, Sticker> } => {
  const stickers = sampleStickers(args.size).slice(0, args.count);
  const sheet = sampleSheet(args.size, stickers, args.skip);
  return { sheet: { ...sheet, settings: { ...sheet.settings, outlines: args.outlines, landscape: args.landscape } }, stickers: byId(stickers) };
};

/** The on-screen editor with local state, so selecting, swapping, moving and removing work */
function Editor(args: Args) {
  const initial = sheetOf(args);
  const [sheet, setSheet] = useState(initial.sheet);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const setItems = (fn: (items: Sheet['items']) => Sheet['items']) => setSheet((s) => ({ ...s, items: fn(s.items) }));
  return (
    <StickerSheetEditor
      sheet={sheet}
      stickers={initial.stickers}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAppend={() => {}}
      onMove={(from, to) =>
        setItems((items) => {
          const next = [...items];
          next.splice(to, 0, ...next.splice(from, 1));
          return next;
        })
      }
      onSwap={(a, b) =>
        setItems((items) => {
          const next = [...items];
          [next[a], next[b]] = [next[b], next[a]];
          return next;
        })
      }
      onInsert={(stickerId, index) =>
        setItems((items) => [...items.slice(0, index), { id: crypto.randomUUID(), stickerId }, ...items.slice(index)])
      }
      onRemove={(id) => setItems((items) => items.filter((i) => i.id !== id))}
    />
  );
}

const meta = {
  title: 'Sheet',
  args: { size: '1.5u', skip: 0, outlines: false, landscape: false, count: 12 },
  argTypes: {
    size: { control: 'inline-radio', options: ['1.5u', '1u'] },
    count: { control: { type: 'range', min: 0, max: 12 } },
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ background: '#eeeff2', padding: 24, minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sheet as edited on screen: click to select, drag onto a sticker to swap or into a gap to move */
export const EditorView: Story = {
  // Remounts on arg changes, so the controls reset the sheet
  render: (args) => <Editor key={JSON.stringify(args)} {...args} />,
};

export const EditorView1U: Story = {
  ...EditorView,
  args: { size: '1u' },
};

export const EditorWithSkippedSlots: Story = {
  ...EditorView,
  args: { skip: 4 },
};

/** The first page as printed and rendered into the xTool export */
export const Printed: Story = {
  args: { outlines: true },
  render: (args) => {
    const { sheet, stickers } = sheetOf(args);
    const pages = paginate(sheet, stickers);
    return <PrintedPage sheet={sheet} slots={pages[0]} page={1} pageCount={pages.length} />;
  },
};
