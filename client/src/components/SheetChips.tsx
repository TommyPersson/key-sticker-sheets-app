import { Chip, Tooltip } from '@mui/material';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import { sizeLabel } from '../paper';
import type { StickerSize } from '../types';

const chipSx = { height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } } as const;

/** A sheet's or library's key size, coloured per size so they are easy to tell apart */
export function SizeChip({ size }: { size: StickerSize }) {
  return (
    <Chip size="small" label={sizeLabel(size)} color={size === '1u' ? 'secondary' : 'primary'} sx={{ ...chipSx, fontWeight: 600 }} />
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
