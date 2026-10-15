import { Fragment, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '@mui/icons-material/Close';
import { iconUrl } from '../api';
import { dimensionsOf, gridFor, mm, paperSize } from '../paper';
import { layoutOf, type Anchor, type StickerComponent, type StickerLayout } from '../layouts';
import type { Sheet, SheetDimensions, SheetItem, SheetSettings, Sticker } from '../types';
import './sheet.css';

export const perPage = (settings: SheetSettings) => gridFor(settings).perPage;

/** Drag data type used when dragging a sticker out of the library */
export const LIBRARY_DRAG_TYPE = 'application/x-library-sticker';

const MISSING: Sticker = { id: '', line1: '?', line2: 'MISSING', shortcut: '', icon: '', category: '', size: '1.5u', layout: '' };

export type Slot =
  | { kind: 'skipped' }
  | { kind: 'sticker'; item: SheetItem; sticker: Sticker; index: number }
  | { kind: 'empty' };

/** Lays the stickers out on as many pages as needed, honouring the skip offset on the first page. */
export function paginate(sheet: Sheet, stickers: Record<string, Sticker>): Slot[][] {
  const slots: Slot[] = [
    ...Array.from({ length: sheet.settings.skip }, (): Slot => ({ kind: 'skipped' })),
    ...sheet.items.map(
      (item, index): Slot => ({ kind: 'sticker', item, sticker: stickers[item.stickerId] ?? MISSING, index }),
    ),
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
  overlay,
  children,
}: {
  sheet: Sheet;
  page: number;
  pageCount: number;
  interactive?: boolean;
  /** Absolutely positioned elements over the sheet, in its coordinates */
  overlay?: React.ReactNode;
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
      className={`ks-paper${interactive ? ' ks-paper-preview' : ''}`}
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
        {overlay}
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

const ANCHOR_ALIGNMENT: Record<Anchor, [h: string, v: string]> = {
  'top-left': ['start', 'start'],
  top: ['center', 'start'],
  'top-right': ['end', 'start'],
  left: ['start', 'center'],
  center: ['center', 'center'],
  right: ['end', 'center'],
  'bottom-left': ['start', 'end'],
  bottom: ['center', 'end'],
  'bottom-right': ['end', 'end'],
};

/** A sticker's printed content, arranged by its layout */
export function StickerFace({
  sticker,
  placeholder,
  layout = layoutOf(sticker),
}: {
  sticker: Sticker;
  placeholder?: boolean;
  /** Overrides the sticker's own layout, e.g. to preview another one */
  layout?: StickerLayout;
}) {
  const blank = !sticker.line1 && !sticker.line2 && !sticker.shortcut && !sticker.icon;
  const line1 = blank && placeholder ? 'Empty' : sticker.line1;
  // Layouts with a larger icon scale it to fit a square of that size
  const iconStyle: React.CSSProperties | undefined = layout.iconSize
    ? { width: `${layout.iconSize}mm`, height: `${layout.iconSize}mm`, maxWidth: 'none', maxHeight: 'none', objectFit: 'contain' }
    : undefined;
  const components: Record<StickerComponent, React.ReactNode> = {
    // An empty first line keeps its height, so the second line stays in place
    text: (line1 || sticker.line2) && (
      <span className="ks-text">
        <span className="ks-line1">{line1}</span>
        {sticker.line2 && <span className="ks-line2">{sticker.line2}</span>}
      </span>
    ),
    icon: sticker.icon && (
      <img
        className="ks-icon"
        src={iconUrl(sticker.icon)}
        alt=""
        draggable={false}
        style={iconStyle}
      />
    ),
    shortcut: sticker.shortcut && <span className="ks-shortcut">{sticker.shortcut}</span>,
  };
  const areas = (!sticker.shortcut && layout.withoutShortcut) || layout.areas;
  return (
    <>
      {areas.map((area) => {
        const [h, v] = ANCHOR_ALIGNMENT[area.anchor];
        return (
          <div
            key={area.anchor}
            className={[
              'ks-area',
              area.row && 'row',
              area.aboveShortcut && sticker.shortcut && 'above-shortcut',
              area.belowIcon && sticker.icon && 'below-icon',
            ]
              .filter(Boolean)
              .join(' ')}
            style={layout.iconSize ? ({ '--icon-size': `${layout.iconSize}mm` } as React.CSSProperties) : undefined}
            data-h={h}
            data-v={v}
          >
            {area.components.map((c) => (
              <Fragment key={c}>{components[c]}</Fragment>
            ))}
          </div>
        );
      })}
    </>
  );
}

interface InteractiveProps {
  sheet: Sheet;
  stickers: Record<string, Sticker>;
  /** Selected sheet item id */
  selectedId: string | null;
  /** Library sticker whose placements are highlighted */
  highlightStickerId?: string | null;
  onSelect: (itemId: string) => void;
  onAppend: () => void;
  onMove: (from: number, to: number) => void;
  /** A sticker was dropped on another: they trade places */
  onSwap: (a: number, b: number) => void;
  /** A library sticker was dropped: insert it at this index */
  onInsert: (stickerId: string, index: number) => void;
  /** Takes the placement off the sheet */
  onRemove: (itemId: string) => void;
}

type Drop = { slot: number; mode: 'move' | 'insert' } | null;

/** On-screen, editable rendering of the sheet. */
export function StickerSheetEditor({
  sheet,
  stickers,
  selectedId,
  highlightStickerId,
  onSelect,
  onAppend,
  onMove,
  onSwap,
  onInsert,
  onRemove,
}: InteractiveProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const pages = paginate(sheet, stickers);
  const size = perPage(sheet.settings);
  const count = sheet.items.length;

  // Insertion index of the gap being dragged over
  const [gapDrop, setGapDrop] = useState<number | null>(null);
  const grid = gridFor(sheet.settings);
  const d = dimensionsOf(sheet.settings);

  const endDrag = () => {
    setDragIndex(null);
    setDrop(null);
    setGapDrop(null);
  };

  /** Drop targets in the gaps between stickers, where a drop inserts instead of swapping */
  const gaps = (pageIndex: number) =>
    Array.from({ length: grid.rows }, (_, row) =>
      Array.from({ length: grid.columns + 1 }, (_, column) => {
        const at = pageIndex * size + row * grid.columns + column - sheet.settings.skip;
        if (at < 0 || at > count) return null;
        // A move that would leave the dragged sticker where it is
        const noop = dragIndex !== null && (at === dragIndex || at === dragIndex + 1);
        const width = d.gapX + 1.5;
        return (
          <div
            key={`${row}-${column}`}
            className={`ks-gap${gapDrop === at && !noop ? ' active' : ''}`}
            style={{
              left: `${d.sheetPadding + column * (d.cellWidth + d.gapX) - d.gapX / 2 - width / 2}mm`,
              top: `${d.sheetPadding + row * (d.cellHeight + d.gapY)}mm`,
              width: `${width}mm`,
              height: `${d.cellHeight}mm`,
            }}
            onDragOver={(e) => {
              if (dragIndex !== null ? noop : !e.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = dragIndex !== null ? 'move' : 'copy';
              setDrop(null);
              setGapDrop(at);
            }}
            onDragLeave={() => setGapDrop((g) => (g === at ? null : g))}
            onDrop={(e) => {
              e.preventDefault();
              const stickerId = e.dataTransfer.getData(LIBRARY_DRAG_TYPE);
              if (dragIndex !== null) onMove(dragIndex, at > dragIndex ? at - 1 : at);
              else if (stickerId) onInsert(stickerId, at);
              endDrag();
            }}
          />
        );
      }),
    );

  return (
    <>
      {pages.map((slots, pageIndex) => (
        <Paper
          key={pageIndex}
          sheet={sheet}
          page={pageIndex + 1}
          pageCount={pages.length}
          interactive
          overlay={gaps(pageIndex)}
        >
          {slots.map((slot, i) => {
            const slotNumber = i + pageIndex * size;
            const key = slot.kind === 'sticker' ? slot.item.id : `${pageIndex}-${i}`;
            if (slot.kind === 'skipped') {
              return <div key={key} className="ks-item skipped" title="Skipped (already used) slot" />;
            }
            // Dropping on a sticker swaps the two; on an empty slot moves to the end. Inserting there appends
            const moveTarget = slot.kind === 'sticker' ? slot.index : count - 1;
            const insertTarget = slot.kind === 'sticker' ? slot.index : count;

            // New stickers are appended, so only the slot they'd land in creates one
            const next = slot.kind === 'empty' && slotNumber === sheet.settings.skip + count;
            const classes = ['ks-item', slot.kind === 'sticker' ? 'filled' : 'empty'];
            if (next) classes.push('next');
            if (slot.kind === 'sticker') {
              if (slot.item.id === selectedId) classes.push('selected');
              if (slot.item.stickerId === highlightStickerId) classes.push('highlighted');
              if (slot.index === dragIndex) classes.push('dragging');
              const s = slot.sticker;
              if (!s.line1 && !s.line2 && !s.shortcut && !s.icon) classes.push('placeholder-text');
            }
            if (drop?.slot === slotNumber) {
              if (drop.mode === 'insert') classes.push(slot.kind === 'sticker' ? 'insert-before' : 'drop-target');
              else if (moveTarget !== dragIndex) classes.push('drop-target');
            }

            return (
              <div
                key={key}
                className={classes.join(' ')}
                draggable={slot.kind === 'sticker'}
                onClick={() => {
                  if (slot.kind === 'sticker') onSelect(slot.item.id);
                  else if (next) onAppend();
                }}
                title={next ? 'Add a new sticker, or drop one from the library' : undefined}
                onDragStart={(e) => {
                  if (slot.kind !== 'sticker') return;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', slot.item.id);
                  setDragIndex(slot.index);
                }}
                onDragOver={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setGapDrop(null);
                    setDrop({ slot: slotNumber, mode: 'move' });
                  } else if (e.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setGapDrop(null);
                    setDrop({ slot: slotNumber, mode: 'insert' });
                  }
                }}
                onDragLeave={() => setDrop((d) => (d?.slot === slotNumber ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  const stickerId = e.dataTransfer.getData(LIBRARY_DRAG_TYPE);
                  if (dragIndex !== null) {
                    if (moveTarget !== dragIndex) {
                      if (slot.kind === 'sticker') onSwap(dragIndex, slot.index);
                      else onMove(dragIndex, moveTarget);
                    }
                  } else if (stickerId) {
                    onInsert(stickerId, insertTarget);
                  }
                  endDrag();
                }}
                onDragEnd={endDrag}
              >
                {slot.kind === 'sticker' && (
                  <>
                    <StickerFace sticker={slot.sticker} placeholder />
                    <button
                      type="button"
                      className="ks-remove"
                      title="Remove from sheet"
                      aria-label="Remove from sheet"
                      draggable={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(slot.item.id);
                      }}
                    >
                      <CloseIcon />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </Paper>
      ))}
    </>
  );
}

/** Print-only rendering, portalled to <body> and shown exclusively by the print stylesheet. */
export function StickerSheetPrint({ sheet, stickers }: { sheet: Sheet; stickers: Record<string, Sticker> }) {
  const paper = paperSize(sheet.settings);
  const pages = paginate(sheet, stickers);
  return createPortal(
    <div className="ks-print-root">
      {/* Margins are drawn by the paper element itself so print matches the preview exactly */}
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      {pages.map((slots, pageIndex) => (
        <PrintedPage key={pageIndex} sheet={sheet} slots={slots} page={pageIndex + 1} pageCount={pages.length} />
      ))}
    </div>,
    document.body,
  );
}

/** One printed page, as it comes out of the printer */
export function PrintedPage({
  sheet,
  slots,
  page,
  pageCount,
}: {
  sheet: Sheet;
  slots: Slot[];
  page: number;
  pageCount: number;
}) {
  return (
    <Paper sheet={sheet} page={page} pageCount={pageCount}>
      {slots.map((slot, i) => (
        <div key={i} className={`ks-item${slot.kind === 'sticker' ? ' filled' : ''}`}>
          {slot.kind === 'sticker' && <StickerFace sticker={slot.sticker} />}
        </div>
      ))}
    </Paper>
  );
}
