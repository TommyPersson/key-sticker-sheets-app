import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Sheet, Sticker } from './types';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

/** Everything that is edited, and undone, together: the open sheet and the sticker library. */
export interface Workspace {
  sheet: Sheet | null;
  stickers: Record<string, Sticker>;
}

const AUTOSAVE_DELAY_MS = 700;
const COALESCE_MS = 1000;
const MAX_HISTORY = 200;

const EMPTY: Workspace = { sheet: null, stickers: {} };

/**
 * Holds the open sheet and the sticker library, with undo/redo and debounced autosave.
 * Objects are replaced (never mutated) on edit, so saving only sends what changed by identity.
 */
export function useWorkspace(onSheetSaved: (sheet: Sheet) => void, onError: (message: string) => void) {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });

  const current = useRef<Workspace>(EMPTY);
  /** What the server has: compared by identity to find unsaved changes */
  const saved = useRef<Workspace>(EMPTY);
  const past = useRef<Workspace[]>([]);
  const future = useRef<Workspace[]>([]);
  const lastEdit = useRef({ key: '', at: 0 });
  const saving = useRef<Promise<void> | null>(null);
  const callbacks = useRef({ onSheetSaved, onError });
  callbacks.current = { onSheetSaved, onError };

  const syncHistory = () => setHistorySize({ past: past.current.length, future: future.current.length });

  const isDirty = (w: Workspace) =>
    w.sheet !== saved.current.sheet ||
    Object.keys(w.stickers).some((id) => w.stickers[id] !== saved.current.stickers[id]);

  const apply = (next: Workspace) => {
    current.current = next;
    setWorkspace(next);
    setStatus(isDirty(next) ? 'pending' : 'saved');
  };

  const saveOnce = async () => {
    const snapshot = current.current;
    if (!isDirty(snapshot)) return;
    setStatus('saving');
    try {
      // Stickers first, so the sheet never refers to a sticker the server doesn't have yet
      const changed = Object.values(snapshot.stickers).filter((s) => s !== saved.current.stickers[s.id]);
      for (const sticker of changed) {
        await api.saveSticker(sticker);
        saved.current = { ...saved.current, stickers: { ...saved.current.stickers, [sticker.id]: sticker } };
      }
      if (snapshot.sheet && snapshot.sheet !== saved.current.sheet) {
        const result = await api.updateSheet(snapshot.sheet);
        saved.current = { ...saved.current, sheet: snapshot.sheet };
        callbacks.current.onSheetSaved(result);
      }
      setStatus(isDirty(current.current) ? 'pending' : 'saved');
    } catch (e) {
      setStatus('error');
      callbacks.current.onError(`Saving failed: ${(e as Error).message}`);
    }
  };

  /** Saves pending changes now. Concurrent calls queue up behind the running save. */
  const flush = useCallback(async (): Promise<void> => {
    while (saving.current) await saving.current;
    saving.current = saveOnce().finally(() => {
      saving.current = null;
    });
    await saving.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [workspace, status, flush]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty(current.current)) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetHistory = () => {
    past.current = [];
    future.current = [];
    lastEdit.current = { key: '', at: 0 };
    syncHistory();
  };

  /** Sets server state without history: the library (if given) and/or the open sheet. Flush first. */
  const load = useCallback((sheet: Sheet | null, stickers?: Record<string, Sticker>) => {
    const next = { sheet, stickers: stickers ?? current.current.stickers };
    saved.current = { sheet, stickers: stickers ?? saved.current.stickers };
    resetHistory();
    apply(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Replaces the library with the server's version, keeping the open sheet and history.
   * Flush first. History entries still apply, since restoring merges over the current library.
   */
  const replaceLibrary = useCallback((stickers: Record<string, Sticker>) => {
    saved.current = { ...saved.current, stickers };
    apply({ ...current.current, stickers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Applies an edit. Consecutive edits with the same coalesce key (e.g. typing in one field)
   * within a short time become a single undo step.
   */
  const edit = useCallback((fn: (w: Workspace) => Workspace, coalesceKey = '') => {
    const before = current.current;
    const next = fn(before);
    if (next === before) return;
    const now = Date.now();
    const coalesce = coalesceKey && lastEdit.current.key === coalesceKey && now - lastEdit.current.at < COALESCE_MS;
    if (!coalesce) past.current = [...past.current.slice(-MAX_HISTORY + 1), before];
    future.current = [];
    lastEdit.current = { key: coalesceKey, at: now };
    apply(next);
    syncHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Restores a history entry. Stickers created after it are kept: they already exist in the
   * library, and only their placement on the sheet is undone.
   */
  const restore = (entry: Workspace): Workspace => ({
    sheet: entry.sheet,
    stickers: { ...current.current.stickers, ...entry.stickers },
  });

  const undo = useCallback(() => {
    const previous = past.current.at(-1);
    if (!previous) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, current.current];
    lastEdit.current = { key: '', at: 0 };
    apply(restore(previous));
    syncHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    const next = future.current.at(-1);
    if (!next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, current.current];
    lastEdit.current = { key: '', at: 0 };
    apply(restore(next));
    syncHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Applies a library deletion the server already performed (including removal from sheets). */
  const forgetSticker = useCallback((id: string) => {
    const strip = (w: Workspace): Workspace => {
      const { [id]: _removed, ...stickers } = w.stickers;
      void _removed;
      const sheet = w.sheet && { ...w.sheet, items: w.sheet.items.filter((i) => i.stickerId !== id) };
      return { sheet, stickers };
    };
    const wasSaved = current.current.sheet === saved.current.sheet;
    const next = strip(current.current);
    saved.current = strip(saved.current);
    // The server already updated the sheet; don't treat the stripped copy as an unsaved change
    if (wasSaved) saved.current.sheet = next.sheet;
    // History may still place the deleted sticker, so it can't be kept
    resetHistory();
    apply(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sheet: workspace.sheet,
    stickers: workspace.stickers,
    status,
    load,
    replaceLibrary,
    edit,
    undo,
    redo,
    flush,
    forgetSticker,
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
  };
}
