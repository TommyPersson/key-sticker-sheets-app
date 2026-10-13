import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Popover,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_DIMENSIONS, DIMENSION_LIMITS, PAPER_SIZES, dimensionsOf, gridFor } from '../paper';
import type { SheetDimensions, SheetSettings } from '../types';

interface Props {
  settings: SheetSettings;
  /** coalesceKey groups rapid changes to one field into a single undo step */
  onChange: (patch: Partial<SheetSettings>, coalesceKey?: string) => void;
}

const DIMENSION_FIELDS: { title: string; fields: [keyof SheetDimensions, string, string][] }[] = [
  {
    title: 'Sticker',
    fields: [
      ['cellWidth', 'Width', 'Sticker width'],
      ['cellHeight', 'Height', 'Sticker height'],
    ],
  },
  {
    title: 'Gaps between stickers',
    fields: [
      ['gapX', 'Horizontal', 'Space between columns'],
      ['gapY', 'Vertical', 'Space between rows'],
    ],
  },
  {
    title: 'Margins',
    fields: [
      ['pageMargin', 'Page margin', 'Paper edge to sheet edge'],
      ['sheetPadding', 'Sheet padding', 'Sheet edge to the first sticker; the markers sit in this area'],
    ],
  },
  {
    title: 'Registration markers',
    fields: [
      ['markerInset', 'Inset', 'Sheet edge to the marker corner'],
      ['markerSize', 'Length', 'Length of each marker arm; 0 hides the markers'],
    ],
  },
];

export function PageSetup({ settings, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const grid = gridFor(settings);
  const dimensions = dimensionsOf(settings);
  const isDefault = (Object.keys(DEFAULT_DIMENSIONS) as (keyof SheetDimensions)[]).every(
    (k) => dimensions[k] === DEFAULT_DIMENSIONS[k],
  );

  /** Paper and dimension changes alter the page capacity, so keep the skip offset within it */
  const setLayout = (patch: Partial<SheetSettings>, coalesceKey?: string) => {
    const capacity = gridFor({ ...settings, ...patch }).perPage;
    onChange({ ...patch, skip: Math.min(settings.skip, capacity - 1) }, coalesceKey);
  };

  const orientationToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={settings.landscape ? 'landscape' : 'portrait'}
      onChange={(_, v) => v && setLayout({ landscape: v === 'landscape' })}
    >
      <Tooltip title="Portrait">
        <ToggleButton value="portrait" aria-label="Portrait">
          <CropPortraitIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Landscape">
        <ToggleButton value="landscape" aria-label="Landscape">
          <CropLandscapeIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );

  const setDimension = (key: keyof SheetDimensions, value: number) =>
    setLayout({ dimensions: { ...dimensions, [key]: value } }, `dimensions.${key}`);

  return (
    <>
      <Button
        startIcon={<ArticleIcon />}
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: 'none' }}
      >
        {settings.paper} · {grid.columns}×{grid.rows}
      </Button>
      {/* Also shown directly in the toolbar for quick switching */}
      {orientationToggle}
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={2} sx={{ p: 2, width: 380 }}>
          <Typography variant="subtitle2">Page setup</Typography>

          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label="Paper"
              value={settings.paper}
              onChange={(e) => setLayout({ paper: e.target.value })}
              sx={{ flex: 1 }}
            >
              {PAPER_SIZES.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            {orientationToggle}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: '8px !important' }}>
            Fits {grid.columns} × {grid.rows} = {grid.perPage} stickers per page
          </Typography>

          <Divider />

          {DIMENSION_FIELDS.map((group) => (
            <Box key={group.title}>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                {group.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {group.fields.map(([key, label, help]) => (
                  <NumberField
                    key={key}
                    label={label}
                    title={help}
                    value={dimensions[key]}
                    {...DIMENSION_LIMITS[key]}
                    unit="mm"
                    step={0.5}
                    onChange={(v) => setDimension(key, v)}
                  />
                ))}
              </Box>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<RestartAltIcon />}
            disabled={isDefault}
            onClick={() => setLayout({ dimensions: { ...DEFAULT_DIMENSIONS } })}
            sx={{ alignSelf: 'flex-start' }}
          >
            Reset dimensions to defaults
          </Button>

          <Divider />

          <NumberField
            label="Skip slots"
            helperText="Leave the first slots empty, for partially used sticker paper"
            value={settings.skip}
            min={0}
            max={grid.perPage - 1}
            integer
            onChange={(skip) => onChange({ skip }, 'skip')}
          />

          <FormControlLabel
            control={<Switch checked={settings.outlines} onChange={(e) => onChange({ outlines: e.target.checked })} />}
            label="Print sticker outlines"
          />
        </Stack>
      </Popover>
    </>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
  integer?: boolean;
  unit?: string;
  title?: string;
  helperText?: string;
}

/**
 * Number input that keeps its own text while typing (so "2." or an empty field is allowed)
 * and commits only valid, in-range values. Invalid text reverts on blur.
 */
function NumberField({ label, value, min, max, onChange, step = 1, integer, unit, title, helperText }: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  // Follow external changes such as undo/redo or reset
  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  const parse = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(n) || n < min || n > max) return null;
    return integer ? Math.round(n) : Math.round(n * 100) / 100;
  };
  const invalid = parse(text) === null;

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      title={title}
      value={text}
      error={invalid}
      helperText={invalid ? `${min}–${max}${unit ? ` ${unit}` : ''}` : helperText}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== null && n !== value) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      slotProps={{
        htmlInput: { min, max, step: integer ? 1 : step },
        input: unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined,
      }}
    />
  );
}
