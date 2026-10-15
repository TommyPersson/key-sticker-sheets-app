import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paper } from '@mui/material';
import { SheetList } from '../components/SheetList';
import type { SheetSummary } from '../types';

const SHEETS: SheetSummary[] = [
  { id: 'a', name: 'IntelliJ & system', stickerCount: 57, size: '1.5u' },
  { id: 'b', name: 'Media keys', stickerCount: 9, size: '1u' },
  { id: 'c', name: 'A sheet with a very long name that does not fit', stickerCount: 0, size: '1.5u' },
];

/** The sheet list with local state: selecting, creating and changing sizes update the list */
function SheetsPane({ empty }: { empty: boolean }) {
  const [sheets, setSheets] = useState(empty ? [] : SHEETS);
  const [selectedId, setSelectedId] = useState<string | null>(sheets[0]?.id ?? null);
  return (
    <Paper sx={{ width: 260, height: 400 }}>
      <SheetList
        sheets={sheets}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={(size) =>
          setSheets((list) => [...list, { id: crypto.randomUUID(), name: 'New sheet', stickerCount: 0, size }])
        }
        onImport={() => {}}
        onDuplicate={() => {}}
        onExport={() => {}}
        onDelete={(id) => setSheets((list) => list.filter((s) => s.id !== id))}
        onChangeSize={(id, size) =>
          setSheets((list) => list.map((s) => (s.id === id ? { ...s, size, stickerCount: 0 } : s)))
        }
      />
    </Paper>
  );
}

const meta = {
  title: 'Panels/Sheet list',
  component: SheetsPane,
  args: { empty: false },
} satisfies Meta<typeof SheetsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { empty: true } };
