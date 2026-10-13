import { Alert, Box, Button, ButtonGroup, Divider, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ImageIcon from '@mui/icons-material/Image';
import AddIcon from '@mui/icons-material/Add';
import { StickerFace, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

/** Actions for a sticker selected on the sheet (a placement) */
export interface PlacementActions {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onMakeCopy: () => void;
}

interface Props {
  sticker: Sticker;
  dimensions: SheetDimensions;
  /** Names of the sheets that use this sticker */
  usedOn: string[];
  placement?: PlacementActions;
  /** Present when the sticker was selected in the library and a sheet is open */
  onAddToSheet?: () => void;
  onChange: (patch: Partial<Sticker>) => void;
  onChooseIcon: () => void;
  onDeleteFromLibrary: () => void;
}

const PX_PER_MM = 96 / 25.4;
/** Widest the preview may get inside the side panel, in px */
const PREVIEW_MAX_WIDTH = 290;

export function StickerEditor({
  sticker,
  dimensions,
  usedOn,
  placement,
  onAddToSheet,
  onChange,
  onChooseIcon,
  onDeleteFromLibrary,
}: Props) {
  const previewZoom = Math.min(2, PREVIEW_MAX_WIDTH / (dimensions.cellWidth * PX_PER_MM));
  const field = (key: 'line1' | 'line2' | 'shortcut', label: string) => (
    <TextField
      label={label}
      size="small"
      value={sticker[key]}
      onChange={(e) => onChange({ [key]: e.target.value })}
      fullWidth
    />
  );

  return (
    <Stack spacing={2}>
      {/* Live preview at up to 2x physical size */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Paper variant="outlined" sx={{ zoom: previewZoom, bgcolor: '#fff', color: '#000' }}>
          <div className="ks-page" style={sheetCssVars(dimensions)}>
            <div className="ks-item">
              <StickerFace sticker={sticker} />
            </div>
          </div>
        </Paper>
      </Box>

      {usedOn.length > 1 && (
        <Alert severity="info" sx={{ py: 0 }}>
          Used on {usedOn.length} sheets. Changes apply to all of them.
        </Alert>
      )}

      {field('line1', 'Line 1')}
      {field('line2', 'Line 2')}
      {field('shortcut', 'Shortcut')}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button variant="outlined" startIcon={<ImageIcon />} onClick={onChooseIcon} sx={{ flex: 1 }}>
          {sticker.icon ? 'Change icon' : 'Choose icon'}
        </Button>
        {sticker.icon && (
          <Button color="inherit" onClick={() => onChange({ icon: '' })}>
            Clear
          </Button>
        )}
      </Stack>
      {sticker.icon && (
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', mt: '4px !important' }}>
          {sticker.icon}
        </Typography>
      )}

      <Divider />

      {placement && (
        <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Move earlier">
              <span>
                <Button onClick={() => placement.onMove(-1)} disabled={placement.index === 0}>
                  <ChevronLeftIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Move later">
              <span>
                <Button onClick={() => placement.onMove(1)} disabled={placement.index === placement.count - 1}>
                  <ChevronRightIcon />
                </Button>
              </span>
            </Tooltip>
          </ButtonGroup>
          <Stack direction="row" spacing={0.5} sx={{ '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
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
      )}

      {onAddToSheet && (
        <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddToSheet}>
          Add to sheet
        </Button>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          {usedOn.length === 0 ? 'Not used on any sheet.' : `Used on: ${usedOn.join(', ')}`}
        </Typography>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={onDeleteFromLibrary}
          sx={{ mt: 0.5, ml: -0.5 }}
        >
          Delete from library
        </Button>
      </Box>
    </Stack>
  );
}
