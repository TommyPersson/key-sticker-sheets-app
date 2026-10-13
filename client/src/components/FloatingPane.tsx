import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography, type Theme } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
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
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * 'minimize' collapses the pane to a button that reopens it (the default);
   * 'close' hides it entirely, and the parent decides when it opens;
   * 'none' shows no button.
   */
  dismiss?: 'minimize' | 'close' | 'none';
  /** Size to the content (up to the available height) instead of filling the height */
  fitContent?: boolean;
  /** Placed inside a FloatingColumn instead of positioning itself */
  inline?: boolean;
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
  open,
  onOpenChange,
  children,
  offset,
  topOffset,
  dismiss = 'minimize',
  fitContent = false,
  inline = false,
}: Props) {
  const position = inline ? {} : anchorStyle({ side, offset, topOffset });

  if (!open) {
    if (dismiss !== 'minimize') return null;
    return (
      <Button
        variant="contained"
        color="inherit"
        startIcon={icon}
        onClick={() => onOpenChange?.(true)}
        sx={{ ...position, bgcolor: 'background.paper' }}
      >
        {title}
      </Button>
    );
  }

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
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {dismiss !== 'none' && (
          <Tooltip title={dismiss === 'close' ? 'Close (Esc)' : `Minimize ${name}`}>
            <IconButton
              size="small"
              onClick={() => onOpenChange?.(false)}
              aria-label={`${dismiss === 'close' ? 'Close' : 'Minimize'} ${name}`}
            >
              {dismiss === 'close' ? <CloseIcon fontSize="small" /> : <CloseFullscreenIcon fontSize="small" />}
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

/** Horizontal padding that keeps workspace content clear of an open pane */
export const paneClearance = (open: boolean, width: number) => (t: Theme) =>
  open ? `calc(${width}px + ${t.spacing(PANE_INSET + 3)})` : t.spacing(3);
