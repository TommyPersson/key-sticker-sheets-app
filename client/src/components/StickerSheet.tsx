import { useState } from 'react';
import { createPortal } from 'react-dom';
import { iconUrl } from '../api';
import { dimensionsOf, gridFor, mm, paperSize } from '../paper';
import type { Sheet, SheetDimensions, SheetSettings, Sticker } from '../types';
import './sheet.css';

export const perPage = (settings: SheetSettings) => gridFor(settings).perPage;

type Slot = { kind: 'skipped' } | { kind: 'sticker'; sticker: Sticker; index: number } | { kind: 'empty' };

/** Lays the stickers out on as many pages as needed, honouring the skip offset on the first page. */
export function paginate(sheet: Sheet): Slot[][] {
  const slots: Slot[] = [
    ...Array.from({ length: sheet.settings.skip }, (): Slot => ({ kind: 'skipped' })),
    ...sheet.stickers.map((sticker, index): Slot => ({ kind: 'sticker', sticker, index })),
  ];
  const size = perPage(sheet.settings);
  const pageCount = Math.max(1, Math.ceil(slots.length / size));
  while (slots.length < pageCount * size) slots.push({ kind: 'empty' });
  return Array.from({ length: pageCount }, (_, i) => slots.slice(i * size, (i + 1) * size));
}

/** CSS variables that size a .ks-page from the sheet's dimensions */
export const sheetCssVars = (d: SheetDimensions) =>
  ({
    '--cell-width': `${d.cellWidth}mm`,
    '--cell-height': `${d.cellHeight}mm`,
    '--gap-x': `${d.gapX}mm`,
    '--gap-y': `${d.gapY}mm`,
    '--sheet-padding': `${d.sheetPadding}mm`,
    '--marker-inset': `${d.markerInset}mm`,
    '--marker-size': `${d.markerSize}mm`,
  }) as React.CSSProperties;

/** A sheet of paper at its physical size, holding one page of stickers. */
function Paper({
  sheet,
  page,
  pageCount,
  interactive,
  children,
}: {
  sheet: Sheet;
  page: number;
  pageCount: number;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  const { settings } = sheet;
  const paper = paperSize(settings);
  const grid = gridFor(settings);
  const d = dimensionsOf(settings);
  const classes = ['ks-page'];
  if (interactive) classes.push('ks-interactive');
  if (settings.outlines) classes.push('outlines');
  return (
    <div
      className="ks-paper"
      style={{
        width: `${paper.width}mm`,
        // When printing, stay a hair under the page height so rounding never spills onto a blank page
        height: `${interactive ? paper.height : paper.height - 0.5}mm`,
        padding: `${d.pageMargin}mm`,
      }}
    >
      <div
        className={classes.join(' ')}
        style={{ ...sheetCssVars(d), '--columns': grid.columns, '--rows': grid.rows } as React.CSSProperties}
      >
        {d.markerSize > 0 && (
          <>
            <div className="ks-marker top-left" />
            <div className="ks-marker bottom-right" />
          </>
        )}
        <div className="ks-grid">{children}</div>
      </div>
      <PageInfo sheet={sheet} page={page} pageCount={pageCount} />
    </div>
  );
}

/** Dimensions printed in the bottom margin of each page, for checking print scale and setting up cutters. */
function PageInfo({ sheet, page, pageCount }: { sheet: Sheet; page: number; pageCount: number }) {
  const { settings } = sheet;
  const paper = paperSize(settings);
  const grid = gridFor(settings);
  const d = dimensionsOf(settings);
  const gap = d.gapX === d.gapY ? `${mm(d.gapX)} mm` : `${mm(d.gapX)} × ${mm(d.gapY)} mm (h × v)`;
  return (
    <div className="ks-page-info" style={{ left: `${d.pageMargin}mm`, right: `${d.pageMargin}mm` }}>
      <span>
        {sheet.name} · {settings.paper} {settings.landscape ? 'landscape' : 'portrait'} ({mm(paper.width)} ×{' '}
        {mm(paper.height)} mm) · Page {page} of {pageCount}
      </span>
      <span>
        Sticker {mm(d.cellWidth)} × {mm(d.cellHeight)} mm · Gap {gap} · {grid.columns} × {grid.rows} grid · Page
        margin {mm(d.pageMargin)} mm · First sticker {mm(d.pageMargin + d.sheetPadding)} mm from top/left edge
        {d.markerSize > 0 && ` · Markers ${mm(d.pageMargin + d.markerInset)} mm from edge, ${mm(d.markerSize)} mm long`}
      </span>
    </div>
  );
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
  const size = perPage(sheet.settings);
  const lastIndex = sheet.stickers.length - 1;

  const endDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <>
      {pages.map((slots, pageIndex) => (
        <Paper key={pageIndex} sheet={sheet} page={pageIndex + 1} pageCount={pages.length} interactive>
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
              if (dragIndex !== null && dropIndex === i + pageIndex * size && target !== dragIndex) {
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
                    setDropIndex(i + pageIndex * size);
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
        </Paper>
      ))}
    </>
  );
}

/** Print-only rendering, portalled to <body> and shown exclusively by the print stylesheet. */
export function StickerSheetPrint({ sheet }: { sheet: Sheet }) {
  const paper = paperSize(sheet.settings);
  const pages = paginate(sheet);
  return createPortal(
    <div className="ks-print-root">
      {/* Margins are drawn by the paper element itself so print matches the preview exactly */}
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      {pages.map((slots, pageIndex) => (
        <Paper key={pageIndex} sheet={sheet} page={pageIndex + 1} pageCount={pages.length}>
          {slots.map((slot, i) => (
            <div key={i} className={`ks-item${slot.kind === 'sticker' ? ' filled' : ''}`}>
              {slot.kind === 'sticker' && <StickerFace sticker={slot.sticker} />}
            </div>
          ))}
        </Paper>
      ))}
    </div>,
    document.body,
  );
}
