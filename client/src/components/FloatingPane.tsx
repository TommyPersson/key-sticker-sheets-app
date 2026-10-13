import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography, type Theme } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloseIcon from '@mui/icons-material/Close';

/** Distance between floating panes and the workspace edges, in theme spacing units */
export const PANE_INSET = 1.5;

interface Props {
  title: string;
  icon: React.ReactNode;
  side: 'left' | 'right';
  width: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Extra distance from the side, e.g. to sit next to another pane (px) */
  offset?: number;
  /** Extra distance from the top (px) */
  topOffset?: number;
  /**
   * 'minimize' collapses the pane to a button that reopens it (the default);
   * 'close' hides it entirely, and the parent decides when it opens.
   */
  dismiss?: 'minimize' | 'close';
  /** Size to the content (up to the workspace height) instead of filling the height */
  fitContent?: boolean;
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
  offset = 0,
  topOffset = 0,
  dismiss = 'minimize',
  fitContent = false,
}: Props) {
  const position = {
    position: 'absolute',
    top: (t: Theme) => `calc(${t.spacing(PANE_INSET)} + ${topOffset}px)`,
    [side]: (t: Theme) => `calc(${t.spacing(PANE_INSET)} + ${offset}px)`,
    zIndex: 1,
  } as const;

  if (!open) {
    if (dismiss === 'close') return null;
    return (
      <Button
        variant="contained"
        color="inherit"
        startIcon={icon}
        onClick={() => onOpenChange(true)}
        sx={{ ...position, bgcolor: 'background.paper' }}
      >
        {title}
      </Button>
    );
  }

  const name = title.replace(/\s*\(.*\)$/, '').toLowerCase();
  return (
    <Paper
      elevation={8}
      sx={{
        ...position,
        ...(fitContent
          ? { maxHeight: (t: Theme) => `calc(100% - ${t.spacing(PANE_INSET * 2)} - ${topOffset}px)` }
          : { bottom: (t: Theme) => t.spacing(PANE_INSET) }),
        width,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', pl: 2, pr: 0.5, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', mr: 1, color: 'action.active', '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Tooltip title={dismiss === 'close' ? 'Close (Esc)' : `Minimize ${name}`}>
          <IconButton
            size="small"
            onClick={() => onOpenChange(false)}
            aria-label={`${dismiss === 'close' ? 'Close' : 'Minimize'} ${name}`}
          >
            {dismiss === 'close' ? <CloseIcon fontSize="small" /> : <CloseFullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ flex: fitContent ? '0 1 auto' : 1, minHeight: 0, overflowY: fitContent ? 'auto' : undefined }}>
        {children}
      </Box>
    </Paper>
  );
}

/** Horizontal padding that keeps workspace content clear of an open pane */
export const paneClearance = (open: boolean, width: number) => (t: Theme) =>
  open ? `calc(${width}px + ${t.spacing(PANE_INSET + 3)})` : t.spacing(3);
