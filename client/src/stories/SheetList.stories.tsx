import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { FloatingPane } from '../components/FloatingPane';
import { SheetList, SheetListActions } from '../components/SheetList';
import type { SheetSummary, StickerSize } from '../types';

const SHEETS: SheetSummary[] = [
  { id: 'a', name: 'IntelliJ & system', stickerCount: 57, size: '1.5u' },
  { id: 'b', name: 'Media keys', stickerCount: 9, size: '1u' },
  { id: 'c', name: 'A sheet with a very long name that does not fit', stickerCount: 0, size: '1.5u' },
];

/**
 * The sheets pane as in the app, title bar included, with local state:
 * selecting, creating, deleting and changing sizes update the list
 */
function SheetsPane({ empty }: { empty: boolean }) {
  const [sheets, setSheets] = useState(empty ? [] : SHEETS);
  const [selectedId, setSelectedId] = useState<string | null>(sheets[0]?.id ?? null);
  const create = (size: StickerSize) => {
    const sheet = { id: crypto.randomUUID(), name: 'New sheet', stickerCount: 0, size };
    setSheets((list) => [...list, sheet]);
    setSelectedId(sheet.id);
  };
  return (
    // The pane fills the height it is given, like in the app's workspace
    <Box sx={{ height: 420, display: 'flex', flexDirection: 'column' }}>
      <FloatingPane
        inline
        title={`Sheets (${sheets.length})`}
        icon={<DescriptionIcon />}
        side="left"
        width={260}
        actions={<SheetListActions onCreate={create} onImport={() => {}} />}
      >
        <SheetList
          sheets={sheets}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDuplicate={() => {}}
          onExport={() => {}}
          onDelete={(id) => setSheets((list) => list.filter((s) => s.id !== id))}
          onChangeSize={(id, size) =>
            setSheets((list) => list.map((s) => (s.id === id ? { ...s, size, stickerCount: 0 } : s)))
          }
        />
      </FloatingPane>
    </Box>
  );
}

const meta = {
  title: 'Panels/Sheet list',
  component: SheetsPane,
  // Remounts on arg changes, so the controls reset the list
  render: (args) => <SheetsPane key={String(args.empty)} {...args} />,
  args: { empty: false },
} satisfies Meta<typeof SheetsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

/** New sheet and import are in the title bar */
export const WithSheets: Story = {};

/** Without sheets; new ones are created from the title bar (or the empty workspace, in the app) */
export const Empty: Story = { args: { empty: true } };
