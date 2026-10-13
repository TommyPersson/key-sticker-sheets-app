import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';

/** A sticker selected on the sheet: one placement and what can be done with it */
export interface PlacementActions {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onMakeCopy: () => void;
}

/** A sticker selected in the library, while a sheet is open */
export interface LibraryPlacementActions {
  /** How many times the sticker is already on the sheet */
  placedCount: number;
  onAddToSheet: () => void;
  /** Highlights the sticker's placements on the sheet while true */
  onHighlight: (on: boolean) => void;
}

/** How the selected sticker relates to the open sheet: its position, or adding it there. */
export function SheetPlacement({ placement, library }: { placement?: PlacementActions; library?: LibraryPlacementActions }) {
  if (placement) {
    return (
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Tooltip title="Move earlier">
            <span>
              <IconButton size="small" onClick={() => placement.onMove(-1)} disabled={placement.index === 0}>
                <ChevronLeftIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>
            Position {placement.index + 1} of {placement.count}
          </Typography>
          <Tooltip title="Move later">
            <span>
              <IconButton
                size="small"
                onClick={() => placement.onMove(1)}
                disabled={placement.index === placement.count - 1}
              >
                <ChevronRightIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Tooltip title="Create a separate library sticker for this spot, to edit it without affecting other uses">
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={placement.onMakeCopy}>
              Make a copy
            </Button>
          </Tooltip>
          <Tooltip title="Remove from this sheet (stays in the library)">
            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={placement.onRemove}>
              Remove
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    );
  }

  if (library) {
    return (
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'center', minHeight: 28 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {library.placedCount === 0
              ? 'Not on this sheet yet.'
              : `Placed ${library.placedCount} time${library.placedCount === 1 ? '' : 's'} on this sheet.`}
          </Typography>
          {library.placedCount > 0 && (
            <Tooltip title="Hover to highlight them on the sheet">
              <IconButton
                size="small"
                aria-label="Highlight placements on the sheet"
                onMouseEnter={() => library.onHighlight(true)}
                onMouseLeave={() => library.onHighlight(false)}
                onFocus={() => library.onHighlight(true)}
                onBlur={() => library.onHighlight(false)}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={library.onAddToSheet}>
          Add to sheet
        </Button>
      </Stack>
    );
  }

  return null;
}
