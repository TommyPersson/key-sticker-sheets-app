import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PrintIcon from '@mui/icons-material/Print';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import AddIcon from '@mui/icons-material/Add';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { api } from './api';
import { SheetList } from './components/SheetList';
import { StickerEditor } from './components/StickerEditor';
import { IconPicker } from './components/IconPicker';
import { PER_PAGE, StickerSheetEditor, StickerSheetPrint } from './components/StickerSheet';
import { parseImport } from './importExport';
import { useSheetEditor, type SaveStatus } from './useSheetEditor';
import type { IconInfo, Sheet, SheetSummary, Sticker } from './types';

const SIDEBAR_WIDTH = 260;
const EDITOR_WIDTH = 340;

const newSticker = (): Sticker => ({ id: crypto.randomUUID(), line1: '', line2: '', shortcut: '', icon: '' });

const hashSheetId = () => decodeURIComponent(window.location.hash.replace(/^#\/?sheet\//, '')) || null;

function loadZoom() {
  try {
    return Number(localStorage.getItem('ks-zoom')) || 1.25;
  } catch {
    return 1.25;
  }
}

export default function App() {
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null);
  const [icons, setIcons] = useState<IconInfo[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(loadZoom);
  const [message, setMessage] = useState<{ text: string; severity: 'error' | 'success' } | null>(null);

  const showError = useCallback((text: string) => setMessage({ text, severity: 'error' }), []);
  const onSaved = useCallback((saved: Sheet) => {
    setSheets((list) =>
      list?.map((s) =>
        s.id === saved.id
          ? { id: saved.id, name: saved.name, stickerCount: saved.stickers.length, updatedAt: saved.updatedAt }
          : s,
      ) ?? null,
    );
  }, []);
  const editor = useSheetEditor(onSaved, showError);
  const { sheet, edit } = editor;

  const refreshSheets = useCallback(async () => {
    const list = await api.listSheets();
    setSheets(list);
    return list;
  }, []);

  const refreshIcons = useCallback(() => {
    api.listIcons().then(setIcons, (e) => showError(`Could not load icons: ${e.message}`));
  }, [showError]);

  const openSheet = useCallback(
    async (id: string | null) => {
      await editor.flush();
      setSelectedStickerId(null);
      if (!id) {
        editor.load(null);
        history.replaceState(null, '', window.location.pathname);
        return;
      }
      try {
        editor.load(await api.getSheet(id));
        if (hashSheetId() !== id) history.replaceState(null, '', `#/sheet/${encodeURIComponent(id)}`);
      } catch (e) {
        showError(`Could not open sheet: ${(e as Error).message}`);
      }
    },
    [editor.flush, editor.load, showError],
  );

  // Initial load
  useEffect(() => {
    refreshIcons();
    refreshSheets().then(
      (list) => {
        const wanted = hashSheetId();
        openSheet(list.find((s) => s.id === wanted)?.id ?? list[0]?.id ?? null);
      },
      (e) => showError(`Could not load sheets: ${e.message}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ks-zoom', String(zoom));
    } catch {
      // storage unavailable
    }
  }, [zoom]);

  // ---------- Sticker operations ----------

  const stickers = sheet?.stickers ?? [];
  const selectedIndex = stickers.findIndex((s) => s.id === selectedStickerId);
  const selected = selectedIndex >= 0 ? stickers[selectedIndex] : null;

  const setStickers = (fn: (list: Sticker[]) => Sticker[], key?: string) =>
    edit((s) => ({ ...s, stickers: fn(s.stickers) }), key);

  const insertSticker = (sticker: Sticker, at: number) => {
    setStickers((list) => [...list.slice(0, at), sticker, ...list.slice(at)]);
    setSelectedStickerId(sticker.id);
  };

  const addSticker = () => insertSticker(newSticker(), selectedIndex >= 0 ? selectedIndex + 1 : stickers.length);

  const moveSticker = (from: number, to: number) => {
    if (to < 0 || to >= stickers.length || from === to) return;
    setStickers((list) => {
      const copy = [...list];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const deleteSelected = () => {
    if (selectedIndex < 0) return;
    const next = stickers[selectedIndex + 1] ?? stickers[selectedIndex - 1] ?? null;
    setStickers((list) => list.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(next?.id ?? null);
  };

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        editor.redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        editor.flush();
      } else if (!typing && !pickerOpen && selected) {
        const cols = 5;
        const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        if (e.key in moves) {
          e.preventDefault();
          const target = stickers[selectedIndex + moves[e.key]];
          if (target) setSelectedStickerId(target.id);
        } else if (e.key === 'Delete') {
          deleteSelected();
        } else if (e.key === 'Escape') {
          setSelectedStickerId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- Sheet operations ----------

  const createSheet = async (input: Partial<Sheet> = { name: 'New sheet', stickers: [] }) => {
    try {
      const created = await api.createSheet(input);
      await refreshSheets();
      await openSheet(created.id);
      return created;
    } catch (e) {
      showError(`Could not create sheet: ${(e as Error).message}`);
    }
  };

  const duplicateSheet = async (id: string) => {
    await editor.flush();
    const source = await api.getSheet(id);
    await createSheet({
      ...source,
      name: `${source.name} (copy)`,
      stickers: source.stickers.map((s) => ({ ...s, id: crypto.randomUUID() })),
    });
  };

  const deleteSheet = async (id: string) => {
    const summary = sheets?.find((s) => s.id === id);
    if (!confirm(`Delete sheet "${summary?.name}"? This cannot be undone.`)) return;
    try {
      if (sheet?.id === id) editor.load(null);
      await api.deleteSheet(id);
      const list = await refreshSheets();
      if (sheet?.id === id) openSheet(list[0]?.id ?? null);
    } catch (e) {
      showError(`Could not delete sheet: ${(e as Error).message}`);
    }
  };

  const exportSheet = async (id: string) => {
    await editor.flush();
    const data = await api.getSheet(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.name.replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importSheet = async (file: File) => {
    try {
      const imported = parseImport(await file.text(), file.name.replace(/\.json$/i, ''));
      const created = await createSheet(imported);
      if (created) setMessage({ text: `Imported ${created.stickers.length} stickers`, severity: 'success' });
    } catch (e) {
      showError(`Import failed: ${(e as Error).message}`);
    }
  };

  // ---------- Render ----------

  const pageCount = sheet ? Math.max(1, Math.ceil((sheet.settings.skip + stickers.length) / PER_PAGE)) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <KeyboardIcon />
          <Typography variant="h6" sx={{ fontSize: 18 }}>
            Key Sticker Sheets
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sheets */}
        <Paper square elevation={0} sx={{ width: SIDEBAR_WIDTH, borderRight: 1, borderColor: 'divider', flexShrink: 0 }}>
          {sheets === null ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <SheetList
              sheets={sheets}
              selectedId={sheet?.id ?? null}
              onSelect={openSheet}
              onCreate={() => createSheet()}
              onImport={importSheet}
              onDuplicate={duplicateSheet}
              onExport={exportSheet}
              onDelete={deleteSheet}
            />
          )}
        </Paper>

        {sheet ? (
          <>
            {/* Sheet canvas */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Paper
                square
                elevation={0}
                sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <TextField
                  variant="standard"
                  value={sheet.name}
                  onChange={(e) => edit((s) => ({ ...s, name: e.target.value }), 'name')}
                  slotProps={{ htmlInput: { 'aria-label': 'Sheet name', style: { fontSize: 18, fontWeight: 500 } } }}
                  sx={{ minWidth: 200, flex: '0 1 320px' }}
                />
                <SaveIndicator status={editor.status} />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Undo (Ctrl+Z)">
                  <span>
                    <IconButton onClick={editor.undo} disabled={!editor.canUndo}>
                      <UndoIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Redo (Ctrl+Y)">
                  <span>
                    <IconButton onClick={editor.redo} disabled={!editor.canRedo}>
                      <RedoIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Divider orientation="vertical" flexItem />
                <Tooltip title="Slots to leave empty at the start of the first page, for partially used sticker paper">
                  <TextField
                    label="Skip slots"
                    type="number"
                    size="small"
                    value={sheet.settings.skip}
                    onChange={(e) => {
                      const skip = Math.max(0, Math.min(PER_PAGE - 1, Number.parseInt(e.target.value, 10) || 0));
                      edit((s) => ({ ...s, settings: { ...s.settings, skip } }), 'skip');
                    }}
                    slotProps={{ htmlInput: { min: 0, max: PER_PAGE - 1 } }}
                    sx={{ width: 100 }}
                  />
                </Tooltip>
                <FormControlLabel
                  control={
                    <Switch
                      checked={sheet.settings.outlines}
                      onChange={(e) => edit((s) => ({ ...s, settings: { ...s.settings, outlines: e.target.checked } }))}
                    />
                  }
                  label="Outlines"
                />
                <Divider orientation="vertical" flexItem />
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <IconButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">
                    <ZoomOutIcon />
                  </IconButton>
                  <Typography variant="body2" sx={{ width: 44, textAlign: 'center' }}>
                    {Math.round(zoom * 100)}%
                  </Typography>
                  <IconButton onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">
                    <ZoomInIcon />
                  </IconButton>
                </Stack>
                <Button startIcon={<AddIcon />} onClick={addSticker}>
                  Add sticker
                </Button>
                <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!stickers.length}>
                  Print
                </Button>
              </Paper>

              <Box
                sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.200', p: 3 }}
                onClick={(e) => e.target === e.currentTarget && setSelectedStickerId(null)}
              >
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                  {stickers.length} stickers · {pageCount} page{pageCount === 1 ? '' : 's'} · click a slot to edit,
                  drag to reorder
                </Typography>
                <Stack spacing={3} sx={{ zoom, width: 'fit-content', mx: 'auto', '& .ks-page': { boxShadow: 2 } }}>
                  <StickerSheetEditor
                    sheet={sheet}
                    selectedId={selectedStickerId}
                    onSelect={setSelectedStickerId}
                    onAppend={() => insertSticker(newSticker(), stickers.length)}
                    onMove={moveSticker}
                  />
                </Stack>
              </Box>
            </Box>

            {/* Sticker editor */}
            <Paper
              square
              elevation={0}
              sx={{ width: EDITOR_WIDTH, borderLeft: 1, borderColor: 'divider', p: 2, overflowY: 'auto', flexShrink: 0 }}
            >
              {selected ? (
                <StickerEditor
                  key={selected.id}
                  sticker={selected}
                  index={selectedIndex}
                  count={stickers.length}
                  onChange={(patch) =>
                    setStickers(
                      (list) => list.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)),
                      `${selected.id}:${Object.keys(patch).join()}`,
                    )
                  }
                  onChooseIcon={() => setPickerOpen(true)}
                  onDuplicate={() => insertSticker({ ...selected, id: crypto.randomUUID() }, selectedIndex + 1)}
                  onDelete={deleteSelected}
                  onMove={(delta) => moveSticker(selectedIndex, selectedIndex + delta)}
                />
              ) : (
                <Box sx={{ color: 'text.secondary', textAlign: 'center', mt: 6 }}>
                  <Typography variant="body2">Select a sticker to edit it,</Typography>
                  <Typography variant="body2">or click an empty slot to add one.</Typography>
                </Box>
              )}
            </Paper>

            <StickerSheetPrint sheet={sheet} />
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            {sheets?.length === 0 ? (
              <Stack spacing={2} sx={{ alignItems: 'center' }}>
                <Typography>Create your first sticker sheet to get started.</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => createSheet()}>
                  New sheet
                </Button>
              </Stack>
            ) : (
              sheets && <Typography>Select a sheet.</Typography>
            )}
          </Box>
        )}
      </Box>

      {selected && (
        <IconPicker
          open={pickerOpen}
          icons={icons}
          value={selected.icon}
          onClose={() => setPickerOpen(false)}
          onSelect={(icon) => {
            setStickers((list) => list.map((s) => (s.id === selected.id ? { ...s, icon } : s)));
            setPickerOpen(false);
          }}
          onIconsChanged={refreshIcons}
          onError={showError}
        />
      )}

      <Snackbar
        open={!!message}
        autoHideDuration={message?.severity === 'error' ? 8000 : 3000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={message?.severity ?? 'success'} onClose={() => setMessage(null)} variant="filled">
          {message?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'error') return <Chip size="small" color="error" icon={<CloudOffIcon />} label="Not saved" />;
  if (status === 'saved') return <Chip size="small" variant="outlined" icon={<CloudDoneIcon />} label="Saved" />;
  return <Chip size="small" variant="outlined" icon={<CircularProgress size={14} />} label="Saving…" />;
}
