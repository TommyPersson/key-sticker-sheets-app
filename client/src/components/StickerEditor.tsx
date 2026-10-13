import { Box, Button, ButtonGroup, Divider, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ImageIcon from '@mui/icons-material/Image';
import { StickerFace, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

interface Props {
  sticker: Sticker;
  dimensions: SheetDimensions;
  index: number;
  count: number;
  onChange: (patch: Partial<Sticker>) => void;
  onChooseIcon: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}

const PX_PER_MM = 96 / 25.4;
/** Widest the preview may get inside the side panel, in px */
const PREVIEW_MAX_WIDTH = 290;

export function StickerEditor({
  sticker,
  dimensions,
  index,
  count,
  onChange,
  onChooseIcon,
  onDuplicate,
  onDelete,
  onMove,
}: Props) {
  const previewZoom = Math.min(2, PREVIEW_MAX_WIDTH / (dimensions.cellWidth * PX_PER_MM));
  const field = (key: 'line1' | 'line2' | 'shortcut', label: string, helper?: string) => (
    <TextField
      label={label}
      size="small"
      value={sticker[key]}
      helperText={helper}
      onChange={(e) => onChange({ [key]: e.target.value })}
      fullWidth
    />
  );

  return (
    <Stack spacing={2}>
      <Typography variant="overline" color="text.secondary">
        Sticker {index + 1} of {count}
      </Typography>

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

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Move earlier">
            <span>
              <Button onClick={() => onMove(-1)} disabled={index === 0}>
                <ChevronLeftIcon />
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Move later">
            <span>
              <Button onClick={() => onMove(1)} disabled={index === count - 1}>
                <ChevronRightIcon />
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
            Delete
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
