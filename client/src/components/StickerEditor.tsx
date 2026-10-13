import { useLayoutEffect, useRef } from 'react';
import { Alert, Autocomplete, Box, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ImageIcon from '@mui/icons-material/Image';
import { StickerFace, sheetCssVars } from './StickerSheet';
import type { SheetDimensions, Sticker } from '../types';

interface Props {
  sticker: Sticker;
  dimensions: SheetDimensions;
  /** Names of the sheets that use this sticker */
  usedOn: string[];
  /** Categories of the other library stickers, offered as suggestions */
  categories: string[];
  onChange: (patch: Partial<Sticker>) => void;
  onChooseIcon: () => void;
  onDeleteFromLibrary: () => void;
}

const PX_PER_MM = 96 / 25.4;
/** Widest the preview may get inside the side panel, in px */
const PREVIEW_MAX_WIDTH = 290;

/** Edits a library sticker. Changes apply wherever the sticker is placed. */
export function StickerEditor({ sticker, dimensions, usedOn, categories, onChange, onChooseIcon, onDeleteFromLibrary }: Props) {
  // Type-ahead completion to select once the completed value has rendered
  const completion = useRef<{ input: HTMLInputElement; start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const c = completion.current;
    completion.current = null;
    if (c && c.input.value.length === c.end) c.input.setSelectionRange(c.start, c.end);
  }, [sticker.category]);

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
      {/* Live preview at up to 2x physical size. The frame is drawn on the sticker's edge, so it keeps its exact proportions. */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            zoom: previewZoom,
            bgcolor: '#fff',
            color: '#000',
            position: 'relative',
            // Overlay, since the sticker's own positioned background would cover an outline
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              border: 1,
              borderColor: 'grey.400',
              pointerEvents: 'none',
            },
          }}
        >
          <div className="ks-page" style={sheetCssVars(dimensions)}>
            <div className="ks-item">
              <StickerFace sticker={sticker} />
            </div>
          </div>
        </Box>
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
      <Stack direction="row" spacing={1}>
        {field('shortcut', 'Shortcut')}
        <Autocomplete
          freeSolo
          fullWidth
          autoHighlight
          openOnFocus
          size="small"
          options={categories}
          // An unchanged category lists every option, not just itself
          filterOptions={(options, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            if (!q || options.some((o) => o.toLowerCase() === q)) return options;
            return options.filter((o) => o.toLowerCase().includes(q));
          }}
          inputValue={sticker.category}
          onInputChange={(event, value, reason) => {
            const input = event?.target instanceof HTMLInputElement ? event.target : null;
            const typing =
              reason === 'input' && !!input && !(event.nativeEvent as InputEvent).inputType?.startsWith('delete');
            // Type-ahead: complete to the first category starting with the typed text, selecting the rest
            const match = typing && value ? categories.find((c) => c.toLowerCase().startsWith(value.toLowerCase())) : undefined;
            const next = match ?? value;
            if (input && match && match.length > value.length) {
              const select = { input, start: value.length, end: match.length };
              if (next !== sticker.category) completion.current = select;
              // Unchanged value: no re-render follows, so select after React restores the input
              else setTimeout(() => input.setSelectionRange(select.start, select.end));
            }
            if (next !== sticker.category) onChange({ category: next });
          }}
          renderInput={(params) => <TextField {...params} label="Category" />}
        />
      </Stack>

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
