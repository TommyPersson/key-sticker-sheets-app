import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { api, iconUrl } from '../api';
import type { IconInfo } from '../types';

interface Props {
  open: boolean;
  icons: IconInfo[];
  /** All icon folders, including empty ones */
  folders: string[];
  /** The selected icon. Without onSelect, the dialog only manages the icon library. */
  value?: string;
  onClose: () => void;
  onSelect?: (path: string) => void;
  /** Number of library stickers using an icon, mentioned before deleting it */
  usage: (path: string) => number;
  onIconsChanged: () => void;
  onError: (message: string) => void;
}

/** Grid of icon tiles */
const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 1,
} as const;

const COLLAPSED_KEY = 'ks-icon-folders-collapsed';

/** Collapsed folder sections, remembered in this browser */
function readCollapsed(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((f) => typeof f === 'string') : []);
  } catch {
    return new Set();
  }
}

export function IconPicker({ open, icons, folders: folderList, value = '', onClose, onSelect, usage, onIconsChanged, onError }: Props) {
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Both dialogs share the remembered state, so pick up changes made in the other one
  useEffect(() => {
    if (open) setCollapsed(readCollapsed());
  }, [open]);
  const toggleFolder = (name: string) => {
    const next = new Set(collapsed);
    if (!next.delete(name)) next.add(name);
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // storage unavailable
    }
  };
  // Folder that files are being dragged over
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  // Name typed for a new folder; null while not creating one
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const folders = useMemo(
    () => [...new Set([...folderList, ...icons.map((i) => i.folder)])].sort((a, b) => a.localeCompare(b)),
    [folderList, icons],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return icons.filter((i) => (!folder || i.folder === folder) && (!q || i.path.toLowerCase().includes(q)));
  }, [icons, search, folder]);

  // Sections per folder, in the order of the folder chips. Empty folders show unless searching.
  const searching = search.trim() !== '';
  const groups = useMemo(
    () =>
      folders
        .filter((name) => !folder || name === folder)
        .map((name) => [name, filtered.filter((i) => i.folder === name)] as const)
        .filter(([, members]) => members.length > 0 || !searching),
    [folders, folder, filtered, searching],
  );

  const createFolder = async () => {
    const name = newFolder?.trim();
    if (!name) return setNewFolder(null);
    try {
      await api.createIconFolder(name);
      setNewFolder(null);
      setFolder(name);
      onIconsChanged();
    } catch (e) {
      onError(`Could not create folder: ${(e as Error).message}`);
    }
  };

  const deleteFolder = async (name: string) => {
    try {
      await api.deleteIconFolder(name);
      if (folder === name) setFolder(null);
      onIconsChanged();
    } catch (e) {
      onError(`Could not delete folder: ${(e as Error).message}`);
    }
  };

  // Folder the file chooser was opened for
  const uploadTarget = useRef('custom');
  const chooseFiles = (target: string) => {
    uploadTarget.current = target;
    fileInput.current?.click();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = uploadTarget.current;
    // Show the new icons, even in a collapsed folder
    if (collapsed.has(target)) toggleFolder(target);
    let last: IconInfo | null = null;
    for (const file of Array.from(files)) {
      try {
        last = await api.uploadIcon(target, file);
      } catch (e) {
        onError(`Upload of ${file.name} failed: ${(e as Error).message}`);
      }
    }
    onIconsChanged();
    if (last && files.length === 1) onSelect?.(last.path);
  };

  const remove = async (icon: IconInfo) => {
    const users = usage(icon.path);
    const effect = users
      ? `${users} sticker${users === 1 ? ' uses' : 's use'} it and will show no icon.`
      : 'No sticker uses it.';
    if (!confirm(`Delete icon "${icon.path}"? ${effect}`)) return;
    try {
      await api.deleteIcon(icon);
      onIconsChanged();
    } catch (e) {
      onError(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* Title, search and close share one row to leave more room for the icons */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', pl: 3, pr: 1.5, py: 1.5 }}>
        <DialogTitle sx={{ p: 0, flex: 1, whiteSpace: 'nowrap' }}>{onSelect ? 'Choose icon' : 'Icon library'}</DialogTitle>
        <TextField
          size="small"
          placeholder="Search icons"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          sx={{ flex: '0 1 320px', minWidth: 160 }}
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
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 480 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Chip label="All" color={folder === null ? 'primary' : 'default'} onClick={() => setFolder(null)} />
          {folders.map((f) => (
            <Chip key={f} label={f} color={folder === f ? 'primary' : 'default'} onClick={() => setFolder(f)} />
          ))}
          {newFolder === null ? (
            <Chip
              icon={<CreateNewFolderIcon />}
              label="Create folder"
              variant="outlined"
              onClick={() => setNewFolder('')}
            />
          ) : (
            <TextField
              size="small"
              placeholder="Folder name"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') {
                  // Cancels the new folder, not the dialog
                  e.stopPropagation();
                  setNewFolder(null);
                }
              }}
              onBlur={() => !newFolder?.trim() && setNewFolder(null)}
              autoFocus
              sx={{ width: 180, '& .MuiInputBase-input': { py: 0.5 } }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" edge="end" onClick={createFolder} aria-label="Create folder">
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        </Stack>

        {/* Each folder section accepts dropped files; drops anywhere else are ignored */}
        <Box
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none';
          }}
          onDrop={(e) => e.preventDefault()}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', flex: 1 }}
        >
          {onSelect && (
            <Box sx={GRID}>
              <IconTile label="No icon" selected={!value} onClick={() => onSelect?.('')}>
                <BlockIcon sx={{ color: 'text.disabled' }} />
              </IconTile>
            </Box>
          )}
          {groups.map(([name, members]) => (
            <Box
              key={name}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                setDropFolder(name);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropFolder(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropFolder(null);
                uploadTarget.current = name;
                upload(e.dataTransfer.files);
              }}
              sx={{
                position: 'relative',
                // Drawn over the section, so the sticky header can't cover it
                '&::after': {
                  content: '""',
                  display: dropFolder === name ? 'block' : 'none',
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  pointerEvents: 'none',
                  borderRadius: 1,
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Stack
                direction="row"
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <ButtonBase
                  onClick={() => toggleFolder(name)}
                  aria-expanded={!collapsed.has(name)}
                  sx={{
                    flex: 1,
                    alignSelf: 'stretch',
                    justifyContent: 'flex-start',
                    gap: 0.75,
                    py: 0.5,
                    pr: 1,
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
                  <FolderIcon sx={{ fontSize: 16, color: 'action.active' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>
                    {name}
                  </Typography>
                  <Typography variant="caption" color={dropFolder === name ? 'primary' : 'text.secondary'}>
                    {dropFolder === name ? `Drop to upload to ${name}` : members.length}
                  </Typography>
                </ButtonBase>
                {!icons.some((i) => i.folder === name) && (
                  <Tooltip title={`Delete empty folder ${name}`}>
                    <IconButton size="small" onClick={() => deleteFolder(name)} aria-label={`Delete folder ${name}`}>
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={`Upload icons to ${name}`}>
                  <IconButton size="small" onClick={() => chooseFiles(name)} aria-label={`Upload icons to ${name}`}>
                    <UploadIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              {!collapsed.has(name) && (
                <Box sx={{ ...GRID, pt: 1 }}>
                  {members.map((icon) => (
                    <IconTile
                      key={icon.path}
                      label={icon.name.replace(/\.[a-z]+$/i, '')}
                      title={icon.path}
                      selected={icon.path === value}
                      onClick={onSelect && (() => onSelect(icon.path))}
                      onDelete={() => remove(icon)}
                    >
                      <img src={iconUrl(icon.path)} alt="" style={{ maxWidth: 24, maxHeight: 24 }} />
                    </IconTile>
                  ))}
                  {members.length === 0 && (
                    <ButtonBase
                      onClick={() => chooseFiles(name)}
                      sx={{
                        gridColumn: '1 / -1',
                        flexDirection: 'column',
                        gap: 0.5,
                        py: 2,
                        borderRadius: 1,
                        border: 1,
                        borderStyle: 'dashed',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', color: 'primary.main' },
                      }}
                    >
                      <UploadIcon />
                      <Typography variant="body2">Upload icons</Typography>
                      <Typography variant="caption">Empty folder. Click to choose files, or drop them here.</Typography>
                    </ButtonBase>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Box>
        {searching && filtered.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
            No icons match.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
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
        <Typography variant="caption" color="text.secondary">
          {filtered.length} icons
        </Typography>
      </DialogActions>
    </Dialog>
  );
}

/** An icon in the grid. The delete button appears while the tile is hovered or focused. */
function IconTile({
  children,
  label,
  title,
  selected,
  onClick,
  onDelete,
}: {
  children: React.ReactNode;
  label: string;
  title?: string;
  selected?: boolean;
  /** Omitted when there is nothing to choose for */
  onClick?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        '& .delete': { opacity: 0 },
        '&:hover .delete, &:focus-within .delete': { opacity: 1 },
      }}
    >
      <Tooltip title={title ?? label} enterDelay={600}>
        <ButtonBase
          onClick={onClick}
          disabled={!onClick}
          sx={{
            width: '100%',
            flexDirection: 'column',
            gap: 0.75,
            p: 1,
            height: 72,
            borderRadius: 1,
            border: 1,
            borderColor: selected ? 'primary.main' : 'divider',
            bgcolor: selected ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
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
      {onDelete && (
        <Tooltip title="Delete icon">
          <IconButton
            className="delete"
            size="small"
            color="error"
            onClick={onDelete}
            aria-label={`Delete ${title ?? label}`}
            sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, transition: 'opacity 0.15s' }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
