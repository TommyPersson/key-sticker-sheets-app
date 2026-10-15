import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { SIZES, sizeLabel } from '../paper';
import type { SheetSummary, StickerSize } from '../types';

/** Menu to pick a new sheet's key size */
function NewSheetMenu({
  anchor,
  onClose,
  onCreate,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  onCreate: (size: StickerSize) => void;
}) {
  return (
    <Menu
      anchorEl={anchor}
      open={!!anchor}
      onClose={onClose}
      slotProps={{ paper: { sx: { minWidth: anchor?.offsetWidth } } }}
    >
      {SIZES.map((size) => (
        <MenuItem
          key={size.id}
          onClick={() => {
            onClose();
            onCreate(size.id);
          }}
        >
          {size.label} sheet
        </MenuItem>
      ))}
    </Menu>
  );
}

/** "New sheet" button with a menu to pick the new sheet's key size, for the empty workspace */
export function NewSheetButton({ onCreate, sx }: { onCreate: (size: StickerSize) => void; sx?: SxProps<Theme> }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        sx={sx}
      >
        New sheet
      </Button>
      <NewSheetMenu anchor={anchor} onClose={() => setAnchor(null)} onCreate={onCreate} />
    </>
  );
}

/** Title bar buttons of the sheets pane: new sheet (with its size menu) and import */
export function SheetListActions({
  onCreate,
  onImport,
}: {
  onCreate: (size: StickerSize) => void;
  onImport: (file: File) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <Tooltip title="New sheet">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label="New sheet" aria-haspopup="menu">
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <NewSheetMenu anchor={anchor} onClose={() => setAnchor(null)} onCreate={onCreate} />
      <Tooltip title="Import sheet from JSON">
        <IconButton size="small" onClick={() => fileInput.current?.click()} aria-label="Import sheet from JSON">
          <FileUploadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

interface Props {
  sheets: SheetSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  /** Changes a sheet's key size; the caller confirms and clears a non-empty sheet */
  onChangeSize: (id: string, size: StickerSize) => void;
}

export function SheetList({
  sheets,
  selectedId,
  onSelect,
  onDuplicate,
  onExport,
  onDelete,
  onChangeSize,
}: Props) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const menuSheet = sheets.find((s) => s.id === menu?.id);

  const act = (fn: (id: string) => void) => () => {
    if (menu) fn(menu.id);
    setMenu(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <List dense sx={{ flex: 1, overflowY: 'auto' }}>
        {sheets.map((s) => (
          <ListItemButton
            key={s.id}
            selected={s.id === selectedId}
            onClick={() => onSelect(s.id)}
            sx={{ pr: 1 }}
          >
            <ListItemText
              primary={s.name}
              secondary={`${sizeLabel(s.size)} · ${s.stickerCount} sticker${s.stickerCount === 1 ? '' : 's'}`}
              slotProps={{ primary: { noWrap: true } }}
            />
            <IconButton
              size="small"
              edge="end"
              aria-label={`Actions for ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenu({ anchor: e.currentTarget, id: s.id });
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
        {sheets.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            No sheets yet.
          </Typography>
        )}
      </List>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <ListSubheader sx={{ lineHeight: '32px' }}>Key size</ListSubheader>
        {SIZES.map((size) => {
          const current = menuSheet?.size === size.id;
          return (
            <MenuItem key={size.id} selected={current} onClick={act((id) => !current && onChangeSize(id, size.id))}>
              <ListItemIcon>{current && <CheckIcon fontSize="small" />}</ListItemIcon>
              {size.label}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={act(onDuplicate)}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          Duplicate
        </MenuItem>
        <MenuItem onClick={act(onExport)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export JSON
        </MenuItem>
        <MenuItem onClick={act(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
