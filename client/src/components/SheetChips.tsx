import { Chip, Tooltip } from '@mui/material';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import { sizeLabel } from '../paper';
import type { StickerSize } from '../types';

const chipSx = { height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } } as const;

/** A colour per size, dark enough for white text; 1.5U and 1U use the theme's primary and secondary */
const SIZE_COLORS: Record<StickerSize, string> = {
  '1u': '#9c27b0',
  '1.25u': '#00838f',
  '1.5u': '#1565c0',
  '1.75u': '#2e7d32',
  '2u': '#e65100',
  '2.25u': '#ad1457',
  '2.75u': '#5d4037',
};

/** A sheet's or library's key size, coloured per size so they are easy to tell apart */
export function SizeChip({ size }: { size: StickerSize }) {
  return (
    <Chip
      size="small"
      label={sizeLabel(size)}
      sx={{ ...chipSx, fontWeight: 600, color: '#fff', bgcolor: SIZE_COLORS[size] }}
    />
  );
}

/** A sheet's paper size and orientation, muted next to the size chip */
export function PaperChip({ paper, landscape }: { paper: string; landscape: boolean }) {
  const orientation = landscape ? 'Landscape' : 'Portrait';
  return (
    <Tooltip title={`${paper} ${orientation.toLowerCase()}`}>
      <Chip
        size="small"
        variant="outlined"
        label={paper}
        icon={landscape ? <CropLandscapeIcon /> : <CropPortraitIcon />}
        aria-label={`${paper} ${orientation.toLowerCase()}`}
        sx={{
          ...chipSx,
          color: 'text.secondary',
          borderColor: 'divider',
          '& .MuiChip-icon': { fontSize: 13, ml: 0.5, mr: -0.25, color: 'text.secondary' },
        }}
      />
    </Tooltip>
  );
}
