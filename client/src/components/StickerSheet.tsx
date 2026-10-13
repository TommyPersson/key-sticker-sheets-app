import { useState } from 'react';
import { createPortal } from 'react-dom';
import { iconUrl } from '../api';
import type { Sheet, Sticker } from '../types';
import './sheet.css';

export const COLUMNS = 5;
export const ROWS = 10;
export const PER_PAGE = COLUMNS * ROWS;

type Slot = { kind: 'skipped' } | { kind: 'sticker'; sticker: Sticker; index: number } | { kind: 'empty' };

/** Lays the stickers out on as many pages as needed, honouring the skip offset on the first page. */
export function paginate(sheet: Sheet): Slot[][] {
  const slots: Slot[] = [
    ...Array.from({ length: sheet.settings.skip }, (): Slot => ({ kind: 'skipped' })),
    ...sheet.stickers.map((sticker, index): Slot => ({ kind: 'sticker', sticker, index })),
  ];
  const pageCount = Math.max(1, Math.ceil(slots.length / PER_PAGE));
  while (slots.length < pageCount * PER_PAGE) slots.push({ kind: 'empty' });
  return Array.from({ length: pageCount }, (_, i) => slots.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
}

export function StickerFace({ sticker, placeholder }: { sticker: Sticker; placeholder?: boolean }) {
  const blank = !sticker.line1 && !sticker.line2 && !sticker.shortcut && !sticker.icon;
  return (
    <>
      <span className="ks-line1">{blank && placeholder ? 'Empty' : sticker.line1}</span>
      <span className="ks-line2">{sticker.line2}</span>
      <span className="ks-shortcut">{sticker.shortcut}</span>
      {sticker.icon && <img className="ks-icon" src={iconUrl(sticker.icon)} alt="" draggable={false} />}
    </>
  );
}

interface InteractiveProps {
  sheet: Sheet;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAppend: () => void;
  onMove: (from: number, to: number) => void;
}

/** On-screen, editable rendering of the sheet. */
export function StickerSheetEditor({ sheet, selectedId, onSelect, onAppend, onMove }: InteractiveProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const pages = paginate(sheet);
  const lastIndex = sheet.stickers.length - 1;

  const endDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <>
      {pages.map((slots, pageIndex) => (
        <div key={pageIndex} className={`ks-page ks-interactive${sheet.settings.outlines ? ' outlines' : ''}`}>
          <div className="ks-marker top-left" />
          <div className="ks-marker bottom-right" />
          <div className="ks-grid">
            {slots.map((slot, i) => {
              const key = slot.kind === 'sticker' ? slot.sticker.id : `${pageIndex}-${i}`;
              if (slot.kind === 'skipped') {
                return <div key={key} className="ks-item skipped" title="Skipped (already used) slot" />;
              }
              // Dropping on an empty slot moves the sticker to the end
              const target = slot.kind === 'sticker' ? slot.index : lastIndex;
              const classes = ['ks-item', slot.kind === 'sticker' ? 'filled' : 'empty'];
              if (slot.kind === 'sticker') {
                if (slot.sticker.id === selectedId) classes.push('selected');
                if (slot.index === dragIndex) classes.push('dragging');
                const s = slot.sticker;
                if (!s.line1 && !s.line2 && !s.shortcut && !s.icon) classes.push('placeholder-text');
              }
              if (dragIndex !== null && dropIndex === i + pageIndex * PER_PAGE && target !== dragIndex) {
                classes.push('drop-target');
              }
              return (
                <div
                  key={key}
                  className={classes.join(' ')}
                  draggable={slot.kind === 'sticker'}
                  onClick={() => (slot.kind === 'sticker' ? onSelect(slot.sticker.id) : onAppend())}
                  title={slot.kind === 'empty' ? 'Add sticker' : undefined}
                  onDragStart={(e) => {
                    if (slot.kind !== 'sticker') return;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', slot.sticker.id);
                    setDragIndex(slot.index);
                  }}
                  onDragOver={(e) => {
                    if (dragIndex === null) return;
                    e.preventDefault();
                    setDropIndex(i + pageIndex * PER_PAGE);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && target !== dragIndex) onMove(dragIndex, target);
                    endDrag();
                  }}
                  onDragEnd={endDrag}
                >
                  {slot.kind === 'sticker' && <StickerFace sticker={slot.sticker} placeholder />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** Print-only rendering, portalled to <body> and shown exclusively by the print stylesheet. */
export function StickerSheetPrint({ sheet }: { sheet: Sheet }) {
  return createPortal(
    <div className="ks-print-root">
      {paginate(sheet).map((slots, pageIndex) => (
        <div key={pageIndex} className={`ks-page${sheet.settings.outlines ? ' outlines' : ''}`}>
          <div className="ks-marker top-left" />
          <div className="ks-marker bottom-right" />
          <div className="ks-grid">
            {slots.map((slot, i) => (
              <div key={i} className={`ks-item${slot.kind === 'sticker' ? ' filled' : ''}`}>
                {slot.kind === 'sticker' && <StickerFace sticker={slot.sticker} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
