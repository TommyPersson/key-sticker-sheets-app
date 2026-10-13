import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Sheet } from './types';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

const AUTOSAVE_DELAY_MS = 700;
const COALESCE_MS = 1000;
const MAX_HISTORY = 200;

/**
 * Holds the sheet being edited, with undo/redo history and debounced autosave to the backend.
 */
export function useSheetEditor(onSaved: (sheet: Sheet) => void, onError: (message: string) => void) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });

  const sheetRef = useRef<Sheet | null>(null);
  const past = useRef<Sheet[]>([]);
  const future = useRef<Sheet[]>([]);
  const lastEdit = useRef({ key: '', at: 0 });
  const version = useRef(0);
  const savedVersion = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const callbacks = useRef({ onSaved, onError });
  callbacks.current = { onSaved, onError };

  const syncHistory = () => setHistorySize({ past: past.current.length, future: future.current.length });

  const apply = (next: Sheet) => {
    sheetRef.current = next;
    version.current++;
    setSheet(next);
    setStatus('pending');
  };

  const save = useCallback(async (): Promise<void> => {
    if (saving.current) await saving.current;
    const current = sheetRef.current;
    const v = version.current;
    if (!current || v === savedVersion.current) return;
    setStatus('saving');
    saving.current = (async () => {
      try {
        const saved = await api.updateSheet(current);
        savedVersion.current = v;
        setStatus(version.current === v ? 'saved' : 'pending');
        callbacks.current.onSaved(saved);
      } catch (e) {
        setStatus('error');
        callbacks.current.onError(`Saving failed: ${(e as Error).message}`);
      }
    })();
    await saving.current;
    saving.current = null;
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [sheet, status, save]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  /** Replaces the edited sheet without history (e.g. after loading another sheet). */
  const load = useCallback((next: Sheet | null) => {
    sheetRef.current = next;
    past.current = [];
    future.current = [];
    lastEdit.current = { key: '', at: 0 };
    version.current++;
    savedVersion.current = version.current;
    setSheet(next);
    setStatus('saved');
    syncHistory();
  }, []);

  /**
   * Applies an edit. Consecutive edits with the same coalesce key (e.g. typing in one field)
   * within a short time become a single undo step.
   */
  const edit = useCallback((fn: (s: Sheet) => Sheet, coalesceKey = '') => {
    const current = sheetRef.current;
    if (!current) return;
    const now = Date.now();
    const coalesce = coalesceKey && lastEdit.current.key === coalesceKey && now - lastEdit.current.at < COALESCE_MS;
    if (!coalesce) {
      past.current = [...past.current.slice(-MAX_HISTORY + 1), current];
    }
    future.current = [];
    lastEdit.current = { key: coalesceKey, at: now };
    apply(fn(current));
    syncHistory();
  }, []);

  const undo = useCallback(() => {
    const current = sheetRef.current;
    const previous = past.current.at(-1);
    if (!current || !previous) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, current];
    lastEdit.current = { key: '', at: 0 };
    apply(previous);
    syncHistory();
  }, []);

  const redo = useCallback(() => {
    const current = sheetRef.current;
    const next = future.current.at(-1);
    if (!current || !next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, current];
    lastEdit.current = { key: '', at: 0 };
    apply(next);
    syncHistory();
  }, []);

  return {
    sheet,
    status,
    load,
    edit,
    undo,
    redo,
    flush: save,
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
  };
}
