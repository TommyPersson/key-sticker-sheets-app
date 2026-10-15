import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paper } from '@mui/material';
import { StickerEditor } from '../components/StickerEditor';
import { defaultDimensions } from '../paper';
import type { StickerSize } from '../types';
import { sampleStickers } from './fixtures';

interface Args {
  size: StickerSize;
  /** Start from an empty sticker, to see the layout thumbnails' sample text */
  blank: boolean;
}

/** The editor at the width of the app's side panel, editing a local copy of a sample sticker */
function EditorPane({ size, blank }: Args) {
  const sample = sampleStickers(size)[2];
  const [sticker, setSticker] = useState(
    blank ? { ...sample, line1: '', line2: '', shortcut: '', icon: '', category: '' } : sample,
  );
  return (
    <Paper sx={{ width: 340, p: 2 }}>
      <StickerEditor
        sticker={sticker}
        dimensions={defaultDimensions(size)}
        usedOn={['Sample sheet', 'Another sheet']}
        categories={['Build', 'Debugging', 'Run', 'VCS']}
        onChange={(patch) => setSticker((s) => ({ ...s, ...patch }))}
        onChooseIcon={() => {}}
      />
    </Paper>
  );
}

const meta = {
  title: 'Panels/Sticker editor',
  // Remounts on arg changes, so the controls reset the sticker
  render: (args) => <EditorPane key={JSON.stringify(args)} {...args} />,
  args: { size: '1.5u', blank: false },
  argTypes: { size: { control: 'inline-radio', options: ['1.5u', '1u'] } },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneU: Story = { args: { size: '1u' } };

export const Blank: Story = { args: { blank: true } };
