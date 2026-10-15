import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paper } from '@mui/material';
import { Library } from '../components/Library';
import { defaultDimensions } from '../paper';
import type { StickerSize } from '../types';
import { byId, sampleStickers } from './fixtures';

interface Args {
  size: StickerSize;
  hasSheet: boolean;
  /** Pane width in px; the app sizes it to whole card columns (40 + 120 per column) */
  width: number;
}

/** The library pane with local state; the first three stickers count as placed on the open sheet */
function LibraryPane({ size, hasSheet, width }: Args) {
  const [stickers, setStickers] = useState(() => sampleStickers(size));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onSheet = new Map(hasSheet ? stickers.slice(0, 3).map((s, i) => [s.id, i + 1]) : []);
  return (
    <Paper sx={{ width, height: 560, overflow: 'hidden' }}>
      <Library
        stickers={byId(stickers)}
        dimensions={defaultDimensions(size)}
        onSheet={onSheet}
        // Every other sticker is unused, to show the dimmed cards
        sheetCount={(id) => (stickers.findIndex((s) => s.id === id) % 2 === 0 ? 1 : 0)}
        hasSheet={hasSheet}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => {}}
        onAddToSheet={() => {}}
        onMove={(id, category) => setStickers((list) => list.map((s) => (s.id === id ? { ...s, category } : s)))}
        onDelete={(id) => setStickers((list) => list.filter((s) => s.id !== id))}
      />
    </Paper>
  );
}

const meta = {
  title: 'Panels/Library',
  component: LibraryPane,
  // Remounts on size changes, so the stickers are those of the size
  render: (args) => <LibraryPane key={args.size} {...args} />,
  args: { size: '1.5u', hasSheet: true, width: 400 },
  argTypes: {
    size: { control: 'inline-radio', options: ['1.5u', '1u'] },
    width: { control: { type: 'range', min: 280, max: 1000, step: 120 } },
  },
} satisfies Meta<typeof LibraryPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneU: Story = { args: { size: '1u' } };

export const WithoutSheet: Story = { args: { hasSheet: false } };
