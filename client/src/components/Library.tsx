import { Fragment, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import LabelOffIcon from '@mui/icons-material/LabelOffOutlined';
import { StickerFace, LIBRARY_DRAG_TYPE, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

type Filter = 'all' | 'onSheet' | 'notOnSheet' | 'unused';

interface Props {
  /** The stickers of the shown size's library */
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
  /** Moves a sticker to another category ('' for none) */
  onMove: (stickerId: string, category: string) => void;
  /** Deletes a sticker from the library; the caller confirms */
  onDelete: (stickerId: string) => void;
}

const PX_PER_MM = 96 / 25.4;
const CARD_WIDTH = 112;
/** A card's 4px padding and 1px border on each side */
const CARD_FRAME = 10;

const searchText = (s: Sticker) => `${s.line1} ${s.line2} ${s.shortcut} ${s.icon} ${s.category}`.toLowerCase();

/** The distinct categories in use, sorted */
export const categoriesOf = (stickers: Record<string, Sticker>) =>
  [...new Set(Object.values(stickers).map((s) => s.category.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
const COLLAPSED_KEY = 'ks-library-collapsed';

/** Collapsed category sections ('' for no category), remembered in this browser */
function readCollapsed(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((c) => typeof c === 'string') : []);
  } catch {
    return new Set();
  }
}

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
  onMove,
  onDelete,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // A card's actions menu, and its "Move to" submenu while open. One menu for all cards, rendered outside
  // them, so its clicks don't reach the card (which selects and drags)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; sticker: Sticker } | null>(null);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);
  const closeMenus = () => {
    setMoveAnchor(null);
    setMenu(null);
  };
  const toggleCategory = (name: string) => {
    const next = new Set(collapsed);
    if (!next.delete(name)) next.add(name);
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // storage unavailable
    }
  };

  const categories = useMemo(() => categoriesOf(stickers), [stickers]);
  // Forget a category once no sticker has it any more
  const category = chosenCategory && categories.includes(chosenCategory) ? chosenCategory : null;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(stickers)
      .filter((s) => !q || searchText(s).includes(q))
      .filter((s) => !category || s.category.trim() === category)
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
  }, [stickers, search, filter, category, onSheet, sheetCount]);

  // Sections per category, in the order of the chips, with uncategorized stickers last
  const groups = useMemo(() => {
    const byCategory = new Map<string, Sticker[]>([...categories, ''].map((name) => [name, []]));
    for (const s of list) byCategory.get(s.category.trim())?.push(s);
    return [...byCategory].filter(([, members]) => members.length > 0);
  }, [list, categories]);

  // The sticker fills the card's width, and the card has the sticker's proportions
  // The categories the menu's sticker can move to, and "no category" if it has one
  const current = menu?.sticker.category.trim() ?? '';
  const moveTargets = [...categories.filter((c) => c !== current), ...(current ? [''] : [])];

  const zoom = (CARD_WIDTH - CARD_FRAME) / (dimensions.cellWidth * PX_PER_MM);
  const cardHeight = dimensions.cellHeight * PX_PER_MM * zoom + CARD_FRAME;
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
          {/* Categories combine with the filters above, and are styled apart from them */}
          {categories.map((name) => (
            <Chip
              key={`category:${name}`}
              size="small"
              icon={<LabelIcon />}
              label={name}
              color="secondary"
              variant={category === name ? 'filled' : 'outlined'}
              onClick={() => setChosenCategory(category === name ? null : name)}
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
        {groups.map(([name, members]) => (
          <Fragment key={name}>
            {categories.length > 0 && (
              <ButtonBase
                onClick={() => toggleCategory(name)}
                aria-expanded={!collapsed.has(name)}
                sx={{
                  gridColumn: '1 / -1',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  justifyContent: 'flex-start',
                  gap: 0.75,
                  py: 0.5,
                  pr: 0.5,
                  bgcolor: 'background.paper',
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ExpandMoreIcon
                  sx={{
                    fontSize: 18,
                    color: 'action.active',
                    transform: collapsed.has(name) ? 'rotate(-90deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                />
                {name && <LabelIcon sx={{ fontSize: 16, color: 'action.active' }} />}
                <Typography variant="caption" sx={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>
                  {name || 'No category'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {members.length}
                </Typography>
              </ButtonBase>
            )}
            {!(categories.length > 0 && collapsed.has(name)) && members.map((sticker) => {
              const placed = onSheet.get(sticker.id) ?? 0;
              const sheets = sheetCount(sticker.id);
              return (
                <Box
                  key={sticker.id}
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
                    // An explicit height: grid rows don't account for aspect-ratio, so cards would overlap
                    height: cardHeight,
                    p: 0.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: sticker.id === selectedId ? 'primary.main' : 'divider',
                    bgcolor: sticker.id === selectedId ? 'action.selected' : 'background.paper',
                    cursor: hasSheet ? 'grab' : 'pointer',
                    opacity: sheets === 0 ? 0.75 : 1,
                    '&:hover': { borderColor: 'primary.light' },
                    '& .card-action': { opacity: 0 },
                    '&:hover .card-action, &:focus-within .card-action': { opacity: 1 },
                  }}
                >
                  <Box sx={{ zoom, bgcolor: '#fff', color: '#000', pointerEvents: 'none' }}>
                    <div className="ks-page" style={sheetCssVars(dimensions)}>
                      <div className="ks-item">
                        <StickerFace sticker={sticker} />
                      </div>
                    </div>
                  </Box>
                  <IconButton
                    className={menu?.sticker.id === sticker.id ? undefined : 'card-action'}
                    size="small"
                    draggable={false}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu({ anchor: e.currentTarget, sticker });
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    aria-label={`More actions for ${[sticker.line1, sticker.line2].filter(Boolean).join(' ') || 'sticker'}`}
                    aria-haspopup="menu"
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      p: 0.25,
                      bgcolor: 'background.paper',
                      transition: 'opacity 0.15s',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {placed > 0 && (
                    <Chip
                      size="small"
                      color="success"
                      label={placed > 1 ? `×${placed}` : '✓'}
                      sx={{ position: 'absolute', bottom: 2, right: 2, height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.6 } }}
                    />
                  )}
                </Box>
              );
            })}
          </Fragment>
        ))}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', mt: 2 }}>
            No stickers match.
          </Typography>
        )}
      </Box>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={(e) => setMoveAnchor(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setMoveAnchor(e.currentTarget);
          }}
          disabled={moveTargets.length === 0}
          aria-haspopup="menu"
          aria-expanded={!!moveAnchor}
        >
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to</ListItemText>
          <ChevronRightIcon fontSize="small" sx={{ ml: 2, color: 'action.active' }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            const id = menu!.sticker.id;
            setMenu(null);
            onDelete(id);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      <Menu
        anchorEl={moveAnchor}
        open={!!moveAnchor}
        onClose={() => setMoveAnchor(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setMoveAnchor(null);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {moveTargets.map((target) => (
          <MenuItem
            key={target}
            onClick={() => {
              const id = menu!.sticker.id;
              closeMenus();
              onMove(id, target);
            }}
          >
            <ListItemIcon>
              {target ? <LabelIcon fontSize="small" /> : <LabelOffIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{target || 'No category'}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
