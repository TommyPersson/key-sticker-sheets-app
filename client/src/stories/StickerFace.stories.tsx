import type { Meta, StoryObj } from '@storybook/react-vite';
import { StickerFace, sheetCssVars } from '../components/StickerSheet';
import { LAYOUTS, layoutsFor } from '../layouts';
import { SIZES, defaultDimensions } from '../paper';
import type { Sticker, StickerSize } from '../types';

interface Args {
  line1: string;
  line2: string;
  shortcut: string;
  /** Icon path below /icons, e.g. intellij/debug.svg; empty for none */
  icon: string;
  /** Screen magnification of the physical-size stickers */
  zoom: number;
}

/** One sticker at physical size (times zoom), with its edge outlined as when printing outlines */
function Preview({ sticker, layoutId, zoom }: { sticker: Sticker; layoutId: string; zoom: number }) {
  const layout = LAYOUTS.find((l) => l.id === layoutId)!;
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ zoom, background: '#fff', width: 'fit-content' }}>
        <div className="ks-page outlines" style={sheetCssVars(defaultDimensions(layout.size))}>
          <div className="ks-item filled">
            <StickerFace sticker={sticker} layout={layout} />
          </div>
        </div>
      </div>
      <figcaption style={{ font: '12px sans-serif', marginTop: 4 }}>{layout.name}</figcaption>
    </figure>
  );
}

const stickerOf = (args: Args, size: StickerSize, layout: string): Sticker => ({
  id: 'story',
  line1: args.line1,
  line2: args.line2,
  shortcut: args.shortcut,
  icon: args.icon,
  category: '',
  size,
  layout,
});

const meta = {
  title: 'Sticker/Layouts',
  args: { line1: 'STEP', line2: 'OVER', shortcut: 'F8', icon: 'intellij/stepOver.svg', zoom: 2 },
  argTypes: { zoom: { control: { type: 'range', min: 1, max: 6, step: 0.5 } } },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Every layout of every size with the same content: one or two text lines, with and without a shortcut */
export const AllLayouts: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 24 }}>
      {SIZES.map((size) => (
        <section key={size.id}>
          <h3 style={{ font: 'bold 14px sans-serif', margin: '0 0 8px' }}>{size.label}</h3>
          {[
            { label: 'Two lines, with shortcut', content: args },
            { label: 'One line, with shortcut', content: { ...args, line2: '' } },
            { label: 'Two lines, without shortcut', content: { ...args, shortcut: '' } },
            { label: 'One line, without shortcut', content: { ...args, line2: '', shortcut: '' } },
          ].map(({ label, content }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <h4 style={{ font: '12px sans-serif', color: '#666', margin: '0 0 6px' }}>{label}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {layoutsFor(size.id).map((layout) => (
                  <Preview
                    key={layout.id}
                    sticker={stickerOf(content, size.id, layout.id)}
                    layoutId={layout.id}
                    zoom={args.zoom}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
};

/** One layout, picked from the controls */
export const SingleLayout: StoryObj<Args & { layout: string }> = {
  args: { layout: LAYOUTS[0].id },
  argTypes: { layout: { control: 'select', options: LAYOUTS.map((l) => l.id) } },
  render: ({ layout, ...args }) => {
    const size = LAYOUTS.find((l) => l.id === layout)!.size;
    return <Preview sticker={stickerOf(args, size, layout)} layoutId={layout} zoom={args.zoom} />;
  },
};

/** Long text and missing parts, to check clipping and alignment */
export const EdgeCases: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {LAYOUTS.flatMap((layout) =>
        [
          { line1: 'EXTRAORDINARILY', line2: 'LONG LABEL', shortcut: 'Ctrl-Alt-Shift-F12', icon: args.icon },
          { line1: 'NO ICON', line2: '', shortcut: 'F1', icon: '' },
          { line1: '', line2: '', shortcut: '', icon: args.icon },
        ].map((content, i) => (
          <Preview
            key={`${layout.id}-${i}`}
            sticker={stickerOf({ ...args, ...content }, layout.size, layout.id)}
            layoutId={layout.id}
            zoom={args.zoom}
          />
        )),
      )}
    </div>
  ),
};
