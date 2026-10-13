import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ImageIcon from '@mui/icons-material/Image';
import { StickerFace, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

interface Props {
  sticker: Sticker;
  dimensions: SheetDimensions;
  /** Names of the sheets that use this sticker */
  usedOn: string[];
  onChange: (patch: Partial<Sticker>) => void;
  onChooseIcon: () => void;
  onDeleteFromLibrary: () => void;
}

const PX_PER_MM = 96 / 25.4;
/** Widest the preview may get inside the side panel, in px */
const PREVIEW_MAX_WIDTH = 290;

/** Edits a library sticker. Changes apply wherever the sticker is placed. */
export function StickerEditor({ sticker, dimensions, usedOn, onChange, onChooseIcon, onDeleteFromLibrary }: Props) {
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

      <Stack direction="row" spacing={1}>
        {field('line1', 'Line 1')}
        {field('line2', 'Line 2')}
      </Stack>
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
