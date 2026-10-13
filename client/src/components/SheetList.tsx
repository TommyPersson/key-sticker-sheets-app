import { useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SheetSummary } from '../types';

interface Props {
  sheets: SheetSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport: (file: File) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SheetList({ sheets, selectedId, onSelect, onCreate, onImport, onDuplicate, onExport, onDelete }: Props) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const act = (fn: (id: string) => void) => () => {
    if (menu) fn(menu.id);
    setMenu(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ p: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} sx={{ flex: 1 }}>
          New sheet
        </Button>
        <IconButton onClick={() => fileInput.current?.click()} title="Import sheet from JSON">
          <FileUploadIcon />
        </IconButton>
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
      </Stack>
      <List dense sx={{ flex: 1, overflowY: 'auto', pt: 0 }}>
        {sheets.map((s) => (
          <ListItemButton
            key={s.id}
            selected={s.id === selectedId}
            onClick={() => onSelect(s.id)}
            sx={{ pr: 1 }}
          >
            <ListItemText
              primary={s.name}
              secondary={`${s.stickerCount} sticker${s.stickerCount === 1 ? '' : 's'}`}
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
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            No sheets yet.
          </Typography>
        )}
      </List>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
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
