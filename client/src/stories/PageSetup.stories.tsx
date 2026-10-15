import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppBar, Toolbar } from '@mui/material';
import { PageSetup } from '../components/PageSetup';
import type { StickerSize } from '../types';
import { sampleSheet } from './fixtures';
import { SIZES } from '../paper';

/** The page setup button and orientation toggle, in an app bar like the app's, with local settings */
function PageSetupBar({ size }: { size: StickerSize }) {
  const [settings, setSettings] = useState(sampleSheet(size, []).settings);
  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <PageSetup settings={settings} onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))} />
      </Toolbar>
    </AppBar>
  );
}

const meta = {
  title: 'Panels/Page setup',
  // Remounts on arg changes, so the controls reset the settings
  render: (args) => <PageSetupBar key={args.size} {...args} />,
  args: { size: '1.5u' },
  argTypes: { size: { control: 'inline-radio', options: SIZES.map((s) => s.id) } },
} satisfies Meta<typeof PageSetupBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click the button to open the page setup popover */
export const Default: Story = {};
