import { useRef } from 'react';
import { Box, IconButton, Paper, Stack, Tooltip, Typography, type Theme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/** Distance between floating panes and the workspace edges, in theme spacing units (clears the canvas scrollbar) */
export const PANE_INSET = 3;

interface Anchor {
  side: 'left' | 'right';
  /** Extra distance from the side, e.g. to sit next to another pane (px) */
  offset?: number;
  /** Extra distance from the top (px) */
  topOffset?: number;
}

/** Absolute position in a corner of the workspace */
const anchorStyle = ({ side, offset = 0, topOffset = 0 }: Anchor) =>
  ({
    position: 'absolute',
    top: (t: Theme) => `calc(${t.spacing(PANE_INSET)} + ${topOffset}px)`,
    [side]: (t: Theme) => `calc(${t.spacing(PANE_INSET)} + ${offset}px)`,
    zIndex: 1,
  }) as const;

/** Height available below the anchor, inside the workspace */
const availableHeight = (topOffset = 0) => (t: Theme) => `calc(100% - ${t.spacing(PANE_INSET * 2)} - ${topOffset}px)`;

interface Props extends Anchor {
  title: string;
  icon: React.ReactNode;
  width: number;
  /** Shows a close button; the parent decides whether the pane is rendered */
  onClose?: () => void;
  children: React.ReactNode;
  /** Size to the content (up to the available height) instead of filling the height */
  fitContent?: boolean;
  /** Placed inside a FloatingColumn instead of positioning itself */
  inline?: boolean;
  /** Shown right after the title, e.g. a chip */
  titleAdornment?: React.ReactNode;
  /** Extra buttons in the title bar, before the dismiss button */
  actions?: React.ReactNode;
  /** Makes the inner edge draggable; called with the width the drag asks for (px) */
  onResize?: (width: number) => void;
}

/**
 * A panel floating over one side of the workspace.
 * The parent must be positioned (position: relative).
 */
export function FloatingPane({
  title,
  icon,
  side,
  width,
  onClose,
  children,
  offset,
  topOffset,
  fitContent = false,
  inline = false,
  titleAdornment,
  actions,
  onResize,
}: Props) {
  // Pointer position and pane width when the resize drag started
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const position = inline ? {} : anchorStyle({ side, offset, topOffset });
  const name = title.replace(/\s*\(.*\)$/, '').toLowerCase();
  const height = inline
    ? { minHeight: 0, flex: fitContent ? '0 1 auto' : 1 }
    : fitContent
      ? { maxHeight: availableHeight(topOffset) }
      : { bottom: (t: Theme) => t.spacing(PANE_INSET) };

  return (
    <Paper
      elevation={8}
      sx={{
        ...position,
        ...height,
        width,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {onResize && (
        <Box
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${name}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            resizeStart.current = { x: e.clientX, width };
          }}
          onPointerMove={(e) => {
            const start = resizeStart.current;
            if (!start) return;
            // The inner edge faces the workspace: dragging towards it widens the pane
            const delta = side === 'right' ? start.x - e.clientX : e.clientX - start.x;
            onResize(start.width + delta);
          }}
          onPointerUp={() => (resizeStart.current = null)}
          onPointerCancel={() => (resizeStart.current = null)}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [side === 'right' ? 'left' : 'right']: 0,
            width: 6,
            zIndex: 2,
            cursor: 'ew-resize',
            '&:hover, &:active': { bgcolor: 'primary.main', opacity: 0.4 },
          }}
        />
      )}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          minHeight: 40,
          pl: 2,
          pr: 0.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', mr: 1, color: 'action.active', '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {title}
          </Typography>
          {titleAdornment}
        </Stack>
        {actions}
        {onClose && (
          <Tooltip title="Close (Esc)">
            <IconButton size="small" onClick={onClose} aria-label={`Close ${name}`}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Box sx={{ flex: fitContent ? '0 1 auto' : 1, minHeight: 0, overflowY: fitContent ? 'auto' : undefined }}>
        {children}
      </Box>
    </Paper>
  );
}

/** Stacks inline FloatingPanes vertically in a corner of the workspace */
export function FloatingColumn({ width, children, ...anchor }: Anchor & { width: number; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        ...anchorStyle(anchor),
        width,
        maxHeight: availableHeight(anchor.topOffset),
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}

/** Horizontal padding that keeps workspace content clear of a pane */
export const paneClearance = (width: number) => (t: Theme) => `calc(${width}px + ${t.spacing(PANE_INSET + 3)})`;
