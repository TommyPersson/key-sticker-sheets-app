import { useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import { api, iconUrl } from '../api';
import type { IconInfo } from '../types';

interface Props {
  open: boolean;
  icons: IconInfo[];
  value: string;
  onClose: () => void;
  onSelect: (path: string) => void;
  onIconsChanged: () => void;
  onError: (message: string) => void;
}

const isDarkVariant = (icon: IconInfo) => /_dark\.[a-z]+$/i.test(icon.name);

export function IconPicker({ open, icons, value, onClose, onSelect, onIconsChanged, onError }: Props) {
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [hideDark, setHideDark] = useState(true);
  const [manage, setManage] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('custom');
  const fileInput = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => [...new Set(icons.map((i) => i.folder))].sort(), [icons]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return icons.filter(
      (i) =>
        (!folder || i.folder === folder) &&
        (!hideDark || !isDarkVariant(i)) &&
        (!q || i.path.toLowerCase().includes(q)),
    );
  }, [icons, search, folder, hideDark]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = uploadFolder.trim() || 'custom';
    let last: IconInfo | null = null;
    for (const file of Array.from(files)) {
      try {
        last = await api.uploadIcon(target, file);
      } catch (e) {
        onError(`Upload of ${file.name} failed: ${(e as Error).message}`);
      }
    }
    onIconsChanged();
    if (last && files.length === 1) onSelect(last.path);
  };

  const remove = async (icon: IconInfo) => {
    if (!confirm(`Delete icon "${icon.path}"? Stickers using it will show no icon.`)) return;
    try {
      await api.deleteIcon(icon);
      onIconsChanged();
    } catch (e) {
      onError(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Choose icon
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 480 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <TextField
            size="small"
            placeholder="Search icons"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            sx={{ flex: 1, minWidth: 200 }}
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
          <FormControlLabel
            control={<Switch size="small" checked={hideDark} onChange={(e) => setHideDark(e.target.checked)} />}
            label="Hide _dark variants"
          />
          <FormControlLabel
            control={<Switch size="small" checked={manage} onChange={(e) => setManage(e.target.checked)} />}
            label="Manage"
          />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Chip label="All" color={folder === null ? 'primary' : 'default'} onClick={() => setFolder(null)} />
          {folders.map((f) => (
            <Chip key={f} label={f} color={folder === f ? 'primary' : 'default'} onClick={() => setFolder(f)} />
          ))}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 1,
            alignContent: 'start',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {!manage && (
            <IconTile label="No icon" selected={!value} onClick={() => onSelect('')}>
              <BlockIcon sx={{ color: 'text.disabled' }} />
            </IconTile>
          )}
          {filtered.map((icon) => (
            <IconTile
              key={icon.path}
              label={icon.name.replace(/\.[a-z]+$/i, '')}
              title={icon.path}
              selected={icon.path === value}
              onClick={() => (manage ? remove(icon) : onSelect(icon.path))}
              danger={manage}
            >
              <img src={iconUrl(icon.path)} alt="" style={{ maxWidth: 24, maxHeight: 24 }} />
            </IconTile>
          ))}
        </Box>
        {filtered.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
            No icons match.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Autocomplete
            freeSolo
            size="small"
            options={folders}
            inputValue={uploadFolder}
            onInputChange={(_, v) => setUploadFolder(v)}
            sx={{ width: 180 }}
            renderInput={(params) => <TextField {...params} label="Upload to folder" />}
          />
          <Button startIcon={<UploadIcon />} variant="outlined" onClick={() => fileInput.current?.click()}>
            Upload icons
          </Button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept=".svg,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = '';
            }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {manage ? 'Click an icon to delete it' : `${filtered.length} icons`}
        </Typography>
      </DialogActions>
    </Dialog>
  );
}

function IconTile({
  children,
  label,
  title,
  selected,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  title?: string;
  selected?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title ?? label} enterDelay={600}>
      <ButtonBase
        onClick={onClick}
        sx={{
          flexDirection: 'column',
          gap: 0.75,
          p: 1,
          height: 72,
          borderRadius: 1,
          border: 1,
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: danger ? 'error.light' : 'action.hover' },
        }}
      >
        <Box sx={{ height: 24, display: 'grid', placeItems: 'center' }}>{children}</Box>
        <Typography
          variant="caption"
          sx={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}
        >
          {label}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}
