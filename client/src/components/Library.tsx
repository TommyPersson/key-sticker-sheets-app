import { useMemo, useState } from 'react';
import { Box, Button, Chip, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { StickerFace, LIBRARY_DRAG_TYPE, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

type Filter = 'all' | 'onSheet' | 'notOnSheet' | 'unused';

interface Props {
  stickers: Record<string, Sticker>;
  dimensions: SheetDimensions;
  /** Number of placements of each sticker on the open sheet */
  onSheet: Map<string, number>;
  /** Number of sheets using each sticker */
  sheetCount: (stickerId: string) => number;
  hasSheet: boolean;
  selectedId: string | null;
  onSelect: (stickerId: string) => void;
  onCreate: () => void;
  onAddToSheet: (stickerId: string) => void;
}

const PX_PER_MM = 96 / 25.4;
const CARD_WIDTH = 112;

const searchText = (s: Sticker) => `${s.line1} ${s.line2} ${s.shortcut} ${s.icon}`.toLowerCase();
const sortKey = (s: Sticker) => `${s.line1} ${s.line2}`.trim().toLowerCase() || '￿';

export function Library({
  stickers,
  dimensions,
  onSheet,
  sheetCount,
  hasSheet,
  selectedId,
  onSelect,
  onCreate,
  onAddToSheet,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(stickers)
      .filter((s) => !q || searchText(s).includes(q))
      .filter((s) => {
        switch (filter) {
          case 'onSheet':
            return onSheet.has(s.id);
          case 'notOnSheet':
            return !onSheet.has(s.id);
          case 'unused':
            return sheetCount(s.id) === 0;
          default:
            return true;
        }
      })
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }, [stickers, search, filter, onSheet, sheetCount]);

  const zoom = Math.min(1, (CARD_WIDTH - 8) / (dimensions.cellWidth * PX_PER_MM));
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ...(hasSheet
      ? ([
          ['onSheet', 'On sheet'],
          ['notOnSheet', 'Not on sheet'],
        ] as [Filter, string][])
      : []),
    ['unused', 'Unused'],
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack spacing={1.5} sx={{ p: 2, pb: 1 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
          New sticker
        </Button>
        <TextField
          size="small"
          placeholder="Search stickers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {filters.map(([value, label]) => (
            <Chip
              key={value}
              size="small"
              label={label}
              color={filter === value ? 'primary' : 'default'}
              onClick={() => setFilter(value)}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {list.length} of {Object.keys(stickers).length} stickers
          {hasSheet && ' · drag onto the sheet, or double-click to append'}
        </Typography>
      </Stack>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 2,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_WIDTH}px, 1fr))`,
          gap: 1,
          alignContent: 'start',
        }}
      >
        {list.map((sticker) => {
          const placed = onSheet.get(sticker.id) ?? 0;
          const sheets = sheetCount(sticker.id);
          return (
            <Tooltip
              key={sticker.id}
              enterDelay={700}
              title={sheets === 0 ? 'Not used on any sheet' : `Used on ${sheets} sheet${sheets === 1 ? '' : 's'}`}
            >
              <Box
                draggable={hasSheet}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData(LIBRARY_DRAG_TYPE, sticker.id);
                  e.dataTransfer.setData('text/plain', [sticker.line1, sticker.line2].filter(Boolean).join(' '));
                }}
                onClick={() => onSelect(sticker.id)}
                onDoubleClick={() => hasSheet && onAddToSheet(sticker.id)}
                sx={{
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                  p: 0.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: sticker.id === selectedId ? 'primary.main' : 'divider',
                  bgcolor: sticker.id === selectedId ? 'action.selected' : 'background.paper',
                  cursor: hasSheet ? 'grab' : 'pointer',
                  opacity: sheets === 0 ? 0.75 : 1,
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                <Box sx={{ zoom, bgcolor: '#fff', color: '#000', pointerEvents: 'none' }}>
                  <div className="ks-page" style={sheetCssVars(dimensions)}>
                    <div className="ks-item">
                      <StickerFace sticker={sticker} />
                    </div>
                  </div>
                </Box>
                {placed > 0 && (
                  <Chip
                    size="small"
                    color="success"
                    label={placed > 1 ? `×${placed}` : '✓'}
                    sx={{ position: 'absolute', bottom: 2, right: 2, height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.6 } }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', mt: 2 }}>
            No stickers match.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
