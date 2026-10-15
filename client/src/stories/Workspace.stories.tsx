import type { Meta, StoryObj } from '@storybook/react-vite';
import { GlobalStyles } from '@mui/material';
import { waitFor } from 'storybook/test';
import App from '../App';
import { layoutsFor } from '../layouts';
import { sampleSheet, sampleStickers } from './fixtures';
import { installMockApi, type MockData } from './mockApi';

const stickers15 = sampleStickers('1.5u');
// The 1U sheet shows off each 1U layout in turn
const stickers1u = sampleStickers('1u').map((s, i, all) => {
  const layouts = layoutsFor('1u');
  return { ...s, layout: layouts[i % layouts.length].id, shortcut: i < all.length / 2 ? s.shortcut : '' };
});

const DATA: MockData = {
  sheets: [
    { ...sampleSheet('1.5u', stickers15), name: 'IDE shortcuts' },
    { ...sampleSheet('1u', stickers1u), name: 'Compact keys' },
  ],
  stickers: [...stickers15, ...stickers1u],
};

interface Args {
  /** Sheet opened at start, or none */
  sheet: string;
  /** Start without any sheets */
  empty: boolean;
}

/**
 * The whole app, running against an in-memory API with sample sheets and stickers. Edits work
 * and are kept until the story reloads; icon uploads and changes are not available.
 */
const meta = {
  title: 'Workspace',
  args: { sheet: 'sheet-1.5u', empty: false },
  argTypes: { sheet: { control: 'inline-radio', options: ['sheet-1.5u', 'sheet-1u'] } },
  parameters: { layout: 'fullscreen' },
  beforeEach: ({ args }) => {
    // The app opens the sheet named in the URL hash
    history.replaceState(null, '', `#/sheet/${args.sheet}`);
    return installMockApi(args.empty ? { sheets: [], stickers: DATA.stickers } : DATA);
  },
  render: () => (
    <>
      {/* As in main.tsx: the app fills the window exactly */}
      <GlobalStyles styles={{ 'html, body': { overflow: 'hidden' } }} />
      <App />
    </>
  ),
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** A 1.5U sheet open */
export const OneAndAHalfU: Story = {};

/** A 1U sheet open, using every 1U layout, half of the stickers without a shortcut */
export const OneU: Story = { args: { sheet: 'sheet-1u' } };

/** A sticker selected on the sheet, which opens the sticker editor */
export const StickerSelected: Story = {
  play: async ({ canvasElement }) => {
    const sticker = await waitFor(() => {
      const item = canvasElement.querySelector<HTMLElement>('.ks-interactive .ks-item.filled');
      if (!item) throw new Error('Sheet not loaded yet');
      return item;
    });
    sticker.click();
  },
};

/** No sheets yet */
export const Empty: Story = { args: { empty: true } };
