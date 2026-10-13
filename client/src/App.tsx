import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PrintIcon from '@mui/icons-material/Print';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import GridViewIcon from '@mui/icons-material/GridView';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { api } from './api';
import { SheetList } from './components/SheetList';
import { Library, categoriesOf } from './components/Library';
import { FloatingColumn, FloatingPane, paneClearance } from './components/FloatingPane';
import { StickerEditor } from './components/StickerEditor';
import { SheetPlacement, type PlacementActions } from './components/SheetPlacement';
import { IconPicker } from './components/IconPicker';
import { StickerSheetEditor, StickerSheetPrint, perPage } from './components/StickerSheet';
import { PageSetup } from './components/PageSetup';
import { DEFAULT_DIMENSIONS, dimensionsOf, gridFor } from './paper';
import { contentKey, parseImport, toSheetFile } from './importExport';
import { useWorkspace, type SaveStatus } from './useWorkspace';
import type { IconInfo, LibrarySticker, Sheet, SheetItem, SheetSummary, Sticker } from './types';

const SHEETS_WIDTH = 260;
/** Fits three columns of library cards, including the scrollbar */
const LIBRARY_WIDTH = 400;
const EDITOR_WIDTH = 340;
/** Space between the editor and the library pane (px) */
const EDITOR_GAP = 12;
/** Height of a minimized pane's button (px) */
const MINIMIZED_PANE_HEIGHT = 36;

/** A sticker placed on the open sheet, or a sticker picked in the library */
type Selection = { kind: 'item'; id: string } | { kind: 'sticker'; id: string } | null;

const blankSticker = (): Sticker => ({ id: crypto.randomUUID(), line1: '', line2: '', shortcut: '', icon: '', category: '' });
const newItem = (stickerId: string): SheetItem => ({ id: crypto.randomUUID(), stickerId });

/** Library list from the server as an id → sticker map (dropping the usage info) */
const toMap = (list: LibrarySticker[]): Record<string, Sticker> =>
  Object.fromEntries(list.map(({ sheets: _sheets, ...sticker }) => [sticker.id, sticker]));
const toRefs = (list: LibrarySticker[]) => Object.fromEntries(list.map((s) => [s.id, s.sheets]));

const hashSheetId = () => decodeURIComponent(window.location.hash.replace(/^#\/?sheet\//, '')) || null;

function stored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

export default function App() {
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null);
  /** Sheet ids using each sticker, as last reported by the server */
  const [stickerRefs, setStickerRefs] = useState<Record<string, string[]>>({});
  const [icons, setIcons] = useState<IconInfo[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  /** Library sticker whose placements are highlighted on the sheet */
  const [highlightStickerId, setHighlightStickerId] = useState<string | null>(null);
  const [sheetsOpen, setSheetsOpen] = useState(() => stored('ks-sheets-pane', 'open') === 'open');
  const [libraryOpen, setLibraryOpen] = useState(() => stored('ks-library', 'open') === 'open');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconLibraryOpen, setIconLibraryOpen] = useState(false);
  const [zoom, setZoom] = useState(() => Number(stored('ks-zoom', '1.25')) || 1.25);
  const [message, setMessage] = useState<{ text: string; severity: 'error' | 'success' } | null>(null);

  const showError = useCallback((text: string) => setMessage({ text, severity: 'error' }), []);
  const onSheetSaved = useCallback((saved: Sheet) => {
    setSheets(
      (list) =>
        list?.map((s) =>
          s.id === saved.id
            ? { id: saved.id, name: saved.name, stickerCount: saved.items.length, updatedAt: saved.updatedAt }
            : s,
        ) ?? null,
    );
  }, []);
  const ws = useWorkspace(onSheetSaved, showError);
  const { sheet, stickers, edit } = ws;

  useEffect(() => store('ks-zoom', String(zoom)), [zoom]);
  useEffect(() => store('ks-sheets-pane', sheetsOpen ? 'open' : 'closed'), [sheetsOpen]);
  useEffect(() => store('ks-library', libraryOpen ? 'open' : 'closed'), [libraryOpen]);

  // ---------- Loading ----------

  const refreshSheets = useCallback(async () => {
    const list = await api.listSheets();
    setSheets(list);
    return list;
  }, []);

  /** Reloads the library from the server. Pending edits are saved first. */
  const refreshLibrary = useCallback(async () => {
    await ws.flush();
    const list = await api.listStickers();
    setStickerRefs(toRefs(list));
    return list;
  }, [ws.flush]);

  const refreshIcons = useCallback(() => {
    api.listIcons().then(setIcons, (e) => showError(`Could not load icons: ${e.message}`));
  }, [showError]);

  const openSheet = useCallback(
    async (id: string | null) => {
      await ws.flush();
      setSelection((s) => (s?.kind === 'item' ? null : s));
      if (!id) {
        ws.load(null);
        history.replaceState(null, '', window.location.pathname);
        return;
      }
      try {
        const [loaded] = await Promise.all([api.getSheet(id), refreshLibrary()]);
        ws.load(loaded);
        if (hashSheetId() !== id) history.replaceState(null, '', `#/sheet/${encodeURIComponent(id)}`);
      } catch (e) {
        showError(`Could not open sheet: ${(e as Error).message}`);
      }
    },
    [ws.flush, ws.load, refreshLibrary, showError],
  );

  // Initial load
  useEffect(() => {
    refreshIcons();
    Promise.all([refreshSheets(), api.listStickers()]).then(
      ([list, library]) => {
        setStickerRefs(toRefs(library));
        ws.load(null, toMap(library));
        const wanted = hashSheetId();
        openSheet(list.find((s) => s.id === wanted)?.id ?? list[0]?.id ?? null);
      },
      (e) => showError(`Could not load data: ${e.message}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The highlight button may unmount without a mouse-leave (e.g. when the selection changes)
  useEffect(() => setHighlightStickerId(null), [selection]);

  // Follow sheet links and back/forward navigation
  useEffect(() => {
    const onHashChange = () => {
      const id = hashSheetId();
      if (id && id !== sheet?.id && sheets?.some((s) => s.id === id)) openSheet(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [sheet?.id, sheets, openSheet]);

  // ---------- Derived state ----------

  const items = sheet?.items ?? [];
  const dimensions = sheet ? dimensionsOf(sheet.settings) : DEFAULT_DIMENSIONS;

  const iconUsage = (path: string) => Object.values(stickers).filter((s) => s.icon === path).length;
  const onSheet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.stickerId, (counts.get(item.stickerId) ?? 0) + 1);
    return counts;
  }, [items]);

  /** Sheets using a sticker: the server's view for other sheets, the live state for the open one */
  const usedOnIds = useCallback(
    (stickerId: string) => {
      const ids = new Set((stickerRefs[stickerId] ?? []).filter((id) => id !== sheet?.id));
      if (sheet && onSheet.has(stickerId)) ids.add(sheet.id);
      return [...ids];
    },
    [stickerRefs, sheet, onSheet],
  );
  const sheetCount = useCallback((stickerId: string) => usedOnIds(stickerId).length, [usedOnIds]);
  const sheetName = (id: string) => (id === sheet?.id ? sheet.name : (sheets?.find((s) => s.id === id)?.name ?? id));

  const selectedIndex = selection?.kind === 'item' ? items.findIndex((i) => i.id === selection.id) : -1;
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;
  const selectedSticker =
    selection?.kind === 'sticker' ? stickers[selection.id] : selectedItem ? stickers[selectedItem.stickerId] : undefined;

  // ---------- Editing ----------

  const setItems = (fn: (list: SheetItem[]) => SheetItem[], key?: string) =>
    edit((w) => (w.sheet ? { ...w, sheet: { ...w.sheet, items: fn(w.sheet.items) } } : w), key);

  const updateSticker = (id: string, patch: Partial<Sticker>, key?: string) =>
    edit((w) => ({ ...w, stickers: { ...w.stickers, [id]: { ...w.stickers[id], ...patch } } }), key);

  /** Places a library sticker on the sheet and selects the placement */
  const place = (stickerId: string, at: number) => {
    const item = newItem(stickerId);
    setItems((list) => [...list.slice(0, at), item, ...list.slice(at)]);
    setSelection({ kind: 'item', id: item.id });
  };

  /** Creates a sticker in the library and, when a position is given, places it on the sheet (one undo step) */
  const createSticker = (at?: number) => {
    const sticker = blankSticker();
    const item = newItem(sticker.id);
    edit((w) => ({
      stickers: { ...w.stickers, [sticker.id]: sticker },
      sheet:
        at !== undefined && w.sheet
          ? { ...w.sheet, items: [...w.sheet.items.slice(0, at), item, ...w.sheet.items.slice(at)] }
          : w.sheet,
    }));
    setSelection(at !== undefined && sheet ? { kind: 'item', id: item.id } : { kind: 'sticker', id: sticker.id });
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((list) => {
      const copy = [...list];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const removeSelectedItem = () => {
    if (!selectedItem) return;
    const next = items[selectedIndex + 1] ?? items[selectedIndex - 1] ?? null;
    setItems((list) => list.filter((i) => i.id !== selectedItem.id));
    setSelection(next ? { kind: 'item', id: next.id } : null);
  };

  /** Points the selected placement at a new copy of its sticker, so it can be edited separately */
  const makeCopy = () => {
    if (!selectedItem || !selectedSticker) return;
    const copy = { ...selectedSticker, id: crypto.randomUUID(), createdAt: undefined, updatedAt: undefined };
    edit((w) => ({
      stickers: { ...w.stickers, [copy.id]: copy },
      sheet: w.sheet && {
        ...w.sheet,
        items: w.sheet.items.map((i) => (i.id === selectedItem.id ? { ...i, stickerId: copy.id } : i)),
      },
    }));
    setMessage({ text: 'This spot now uses its own copy of the sticker', severity: 'success' });
  };

  const deleteFromLibrary = async (stickerId: string) => {
    const usedOn = usedOnIds(stickerId).map(sheetName);
    const where = usedOn.length ? `\n\nIt will also be removed from: ${usedOn.join(', ')}.` : '';
    if (!confirm(`Delete this sticker from the library?${where}\n\nThis cannot be undone.`)) return;
    try {
      await ws.flush();
      await api.deleteSticker(stickerId);
      ws.forgetSticker(stickerId);
      setSelection(null);
      await Promise.all([refreshLibrary(), refreshSheets()]);
    } catch (e) {
      showError(`Could not delete sticker: ${(e as Error).message}`);
    }
  };

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) ws.redo();
        else ws.undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        ws.redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ws.flush();
      } else if (!typing && !pickerOpen && !iconLibraryOpen && e.key === 'Escape') {
        setSelection(null);
      } else if (!typing && !pickerOpen && !iconLibraryOpen && selectedItem && sheet) {
        const cols = gridFor(sheet.settings).columns;
        const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        if (e.key in moves) {
          e.preventDefault();
          const next = items[selectedIndex + moves[e.key]];
          if (next) setSelection({ kind: 'item', id: next.id });
        } else if (e.key === 'Delete') {
          removeSelectedItem();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- Sheet operations ----------

  const createSheet = async (input: Partial<Sheet> = { name: 'New sheet', items: [] }) => {
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
    await ws.flush();
    const source = await api.getSheet(id);
    // The copy places the same library stickers
    await createSheet({ ...source, name: `${source.name} (copy)`, items: source.items.map((i) => newItem(i.stickerId)) });
  };

  const deleteSheet = async (id: string) => {
    const summary = sheets?.find((s) => s.id === id);
    if (!confirm(`Delete sheet "${summary?.name}"? Its stickers stay in the library. This cannot be undone.`)) return;
    try {
      await ws.flush();
      if (sheet?.id === id) ws.load(null);
      await api.deleteSheet(id);
      const list = await refreshSheets();
      await refreshLibrary();
      if (sheet?.id === id) openSheet(list[0]?.id ?? null);
    } catch (e) {
      showError(`Could not delete sheet: ${(e as Error).message}`);
    }
  };

  const exportSheet = async (id: string) => {
    await ws.flush();
    const data = toSheetFile(await api.getSheet(id), stickers);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.name.replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Imports a sheet file, reusing identical library stickers and adding the rest */
  const importSheet = async (file: File) => {
    try {
      const imported = parseImport(await file.text(), file.name.replace(/\.json$/i, ''));
      await ws.flush();
      const library = new Map(Object.values(stickers).map((s) => [contentKey(s), s.id]));
      let added = 0;
      const stickerIds: string[] = [];
      for (const content of imported.stickers) {
        let id = library.get(contentKey(content));
        if (!id) {
          id = (await api.saveSticker({ ...content, id: crypto.randomUUID() })).id;
          library.set(contentKey(content), id);
          added++;
        }
        stickerIds.push(id);
      }
      ws.replaceLibrary(toMap(await refreshLibrary()));
      const created = await createSheet({
        name: imported.name,
        settings: imported.settings,
        items: stickerIds.map(newItem),
      });
      if (created) {
        const reused = stickerIds.length - added;
        setMessage({
          text: `Imported ${stickerIds.length} stickers (${added} new, ${reused} already in the library)`,
          severity: 'success',
        });
      }
    } catch (e) {
      showError(`Import failed: ${(e as Error).message}`);
    }
  };

  // ---------- Render ----------

  const pageCount = sheet ? Math.max(1, Math.ceil((sheet.settings.skip + items.length) / perPage(sheet.settings))) : 0;

  const placement: PlacementActions | undefined =
    selectedItem && sheet
      ? {
          index: selectedIndex,
          count: items.length,
          onMove: (delta) => moveItem(selectedIndex, selectedIndex + delta),
          onRemove: removeSelectedItem,
          onMakeCopy: makeCopy,
        }
      : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar variant="dense" sx={{ gap: 1.5, flexWrap: 'wrap', py: 0.5, ...onBlue }}>
          <KeyboardIcon />
          <Typography variant="h6" sx={{ fontSize: 18, whiteSpace: 'nowrap' }}>
            Key Sticker Sheets
          </Typography>
          {sheet && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <TextField
                variant="standard"
                value={sheet.name}
                onChange={(e) => edit((w) => (w.sheet ? { ...w, sheet: { ...w.sheet, name: e.target.value } } : w), 'name')}
                slotProps={{ htmlInput: { 'aria-label': 'Sheet name', style: { fontSize: 16, fontWeight: 500 } } }}
                sx={{ minWidth: 180, flex: '0 1 300px' }}
              />
              <SaveIndicator status={ws.status} />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Undo (Ctrl+Z)">
                <span>
                  <IconButton color="inherit" onClick={ws.undo} disabled={!ws.canUndo}>
                    <UndoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Y)">
                <span>
                  <IconButton color="inherit" onClick={ws.redo} disabled={!ws.canRedo}>
                    <RedoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Divider orientation="vertical" flexItem />
              <PageSetup
                settings={sheet.settings}
                onChange={(patch, key) =>
                  edit(
                    (w) => (w.sheet ? { ...w, sheet: { ...w.sheet, settings: { ...w.sheet.settings, ...patch } } } : w),
                    key,
                  )
                }
              />
              <Divider orientation="vertical" flexItem />
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <IconButton
                  color="inherit"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  aria-label="Zoom out"
                >
                  <ZoomOutIcon />
                </IconButton>
                <Typography variant="body2" sx={{ width: 44, textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </Typography>
                <IconButton
                  color="inherit"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  aria-label="Zoom in"
                >
                  <ZoomInIcon />
                </IconButton>
              </Stack>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                disabled={!items.length}
                sx={{ bgcolor: 'common.white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
              >
                Print
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Workspace */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: 'grey.200' }}>
            {sheet ? (
              <>
                <Box
                  sx={{
                    height: '100%',
                    overflow: 'auto',
                    // Room for the floating help line above the sheet
                    pt: 6.5,
                    pb: 3,
                    // Keep the sheet clear of the floating panes
                    pl: paneClearance(sheetsOpen, SHEETS_WIDTH),
                    pr: paneClearance(libraryOpen, LIBRARY_WIDTH),
                  }}
                  onClick={(e) => e.target === e.currentTarget && setSelection(null)}
                >
                  <Stack spacing={3} sx={{ zoom, width: 'fit-content', mx: 'auto' }}>
                    <StickerSheetEditor
                      sheet={sheet}
                      stickers={stickers}
                      selectedId={selectedItem?.id ?? null}
                      highlightStickerId={highlightStickerId}
                      onSelect={(id) => setSelection({ kind: 'item', id })}
                      onAppend={() => createSticker(items.length)}
                      onMove={moveItem}
                      onInsert={place}
                    />
                  </Stack>
                </Box>
                {/* Floats over the canvas so it stays put while the sheet scrolls underneath */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  sx={{
                    position: 'absolute',
                    top: (t) => t.spacing(3),
                    left: paneClearance(sheetsOpen, SHEETS_WIDTH),
                    maxWidth: (t) =>
                      `calc(100% - ${paneClearance(sheetsOpen, SHEETS_WIDTH)(t)} - ${paneClearance(libraryOpen, LIBRARY_WIDTH)(t)})`,
                    px: 1,
                    py: 0.25,
                    ml: -1,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.grey[200], 0.85),
                    pointerEvents: 'none',
                  }}
                >
                  {items.length} stickers · {pageCount} page{pageCount === 1 ? '' : 's'} · click a slot to edit, drag to
                  reorder, drag from the library to add
                </Typography>
              </>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'text.secondary',
                  pl: paneClearance(sheetsOpen, SHEETS_WIDTH),
                  pr: paneClearance(libraryOpen, LIBRARY_WIDTH),
                }}
              >
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

            {/* Floating panes */}
            <FloatingPane
              title={`Sheets${sheets ? ` (${sheets.length})` : ''}`}
              icon={<DescriptionIcon />}
              side="left"
              width={SHEETS_WIDTH}
              open={sheetsOpen}
              onOpenChange={setSheetsOpen}
            >
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
            </FloatingPane>
            <FloatingPane
              title={`Library (${Object.keys(stickers).length})`}
              icon={<CollectionsBookmarkIcon />}
              side="right"
              width={LIBRARY_WIDTH}
              open={libraryOpen}
              onOpenChange={setLibraryOpen}
              actions={
                <Tooltip title="Icon library">
                  <IconButton size="small" onClick={() => setIconLibraryOpen(true)} aria-label="Open icon library">
                    <ImageIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <Library
                stickers={stickers}
                dimensions={dimensions}
                onSheet={onSheet}
                sheetCount={sheetCount}
                hasSheet={!!sheet}
                selectedId={selectedSticker?.id ?? null}
                onSelect={(id) => setSelection({ kind: 'sticker', id })}
                onCreate={() => createSticker()}
                onAddToSheet={(id) => place(id, items.length)}
              />
            </FloatingPane>
            {selectedSticker && (
              <FloatingColumn
                side="right"
                width={EDITOR_WIDTH}
                // Next to the library, or below its button when it's minimized
                offset={libraryOpen ? LIBRARY_WIDTH + EDITOR_GAP : 0}
                topOffset={libraryOpen ? 0 : MINIMIZED_PANE_HEIGHT + EDITOR_GAP}
              >
                <FloatingPane
                  inline
                  title="Edit sticker"
                  icon={<EditIcon />}
                  side="right"
                  width={EDITOR_WIDTH}
                  open
                  onOpenChange={(open) => !open && setSelection(null)}
                  dismiss="close"
                  fitContent
                >
                  <Box sx={{ p: 2 }}>
                    <StickerEditor
                      key={selectedSticker.id}
                      sticker={selectedSticker}
                      dimensions={dimensions}
                      usedOn={usedOnIds(selectedSticker.id).map(sheetName)}
                      categories={categoriesOf(
                        Object.fromEntries(Object.entries(stickers).filter(([id]) => id !== selectedSticker.id)),
                      )}
                      onChange={(patch) =>
                        updateSticker(selectedSticker.id, patch, `${selectedSticker.id}:${Object.keys(patch).join()}`)
                      }
                      onChooseIcon={() => setPickerOpen(true)}
                      onDeleteFromLibrary={() => deleteFromLibrary(selectedSticker.id)}
                    />
                  </Box>
                </FloatingPane>
                {sheet && (
                  <FloatingPane
                    inline
                    title="On this sheet"
                    icon={<GridViewIcon />}
                    side="right"
                    width={EDITOR_WIDTH}
                    open
                    dismiss="none"
                    fitContent
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <SheetPlacement
                        placement={placement}
                        library={
                          selection?.kind === 'sticker'
                            ? {
                                placedCount: onSheet.get(selectedSticker.id) ?? 0,
                                onAddToSheet: () => place(selectedSticker.id, items.length),
                                onHighlight: (on) => setHighlightStickerId(on ? selectedSticker.id : null),
                              }
                            : undefined
                        }
                      />
                    </Box>
                  </FloatingPane>
                )}
              </FloatingColumn>
            )}
          </Box>
          {sheet && <StickerSheetPrint sheet={sheet} stickers={stickers} />}
        </Box>

      </Box>

      {selectedSticker && (
        <IconPicker
          open={pickerOpen}
          icons={icons}
          value={selectedSticker.icon}
          onClose={() => setPickerOpen(false)}
          onSelect={(icon) => {
            updateSticker(selectedSticker.id, { icon });
            setPickerOpen(false);
          }}
          usage={iconUsage}
          onIconsChanged={refreshIcons}
          onError={showError}
        />
      )}
      <IconPicker
        open={iconLibraryOpen}
        icons={icons}
        onClose={() => setIconLibraryOpen(false)}
        usage={iconUsage}
        onIconsChanged={refreshIcons}
        onError={showError}
      />

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

/** Light-on-blue styling for controls placed in the app bar */
const onBlue = {
  '& .MuiInput-root': { color: 'inherit' },
  '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255, 255, 255, 0.4)' },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'rgba(255, 255, 255, 0.8)' },
  '& .MuiInput-underline:after': { borderBottomColor: 'common.white' },
  '& .MuiIconButton-root.Mui-disabled': { color: 'rgba(255, 255, 255, 0.35)' },
  '& .MuiDivider-root': { borderColor: 'rgba(255, 255, 255, 0.3)' },
  '& .MuiToggleButton-root': {
    color: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    py: 0.5,
    '&.Mui-selected, &.Mui-selected:hover': { color: 'common.white', bgcolor: 'rgba(255, 255, 255, 0.2)' },
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
  },
} as const;

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'error') return <Chip size="small" color="error" icon={<CloudOffIcon />} label="Not saved" />;
  const light = { color: 'inherit', borderColor: 'rgba(255, 255, 255, 0.5)', '& .MuiChip-icon': { color: 'inherit' } };
  if (status === 'saved') return <Chip size="small" variant="outlined" icon={<CloudDoneIcon />} label="Saved" sx={light} />;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<CircularProgress size={14} color="inherit" />}
      label="Saving…"
      sx={light}
    />
  );
}
