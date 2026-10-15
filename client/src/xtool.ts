import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { PrintedPage, paginate } from './components/StickerSheet';
import sheetCss from './components/sheet.css?raw';
import { dimensionsOf, gridFor, paperSize } from './paper';
import type { Sheet, Sticker } from './types';
import { uuid } from './uuid';

/*
 * Export of a sheet as an xTool Studio project (.xs) for print-then-cut on the M1 Ultra:
 * each page becomes a canvas holding an image of the printed page (for lining up with the camera view)
 * and a knife-cut outline for every sticker on it. The format mirrors a project saved by xTool Studio 1.7.
 */

/** Resolution of the page images */
const DPI = 300;
/** Corner radius of the cut outlines in mm */
const CORNER_RADIUS = 2;
/** Passive knife settings for the sticker outlines */
const KNIFE = { cutValue: 70, speed: 40, repeat: 2 };
const LAYER = '#00befe';
const CSS_PX_PER_MM = 96 / 25.4;

/** xTool's short random ids, e.g. "profile:48BuryU3bgQA" */
const shortId = (prefix: string) => `${prefix}:${uuid().replace(/-/g, '').slice(0, 12)}`;
const round = (n: number) => +n.toFixed(6);
const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));

/** Rounded rectangle as SVG path data, in mm */
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const k = r * (1 - 0.5523); // control point distance from the corner for a circular arc
  const p = (px: number, py: number) => `${round(px)},${round(py)}`;
  return [
    `M${p(x + r, y)}`,
    `L${p(x + w - r, y)}`,
    `C${p(x + w - k, y)} ${p(x + w, y + k)} ${p(x + w, y + r)}`,
    `L${p(x + w, y + h - r)}`,
    `C${p(x + w, y + h - k)} ${p(x + w - k, y + h)} ${p(x + w - r, y + h)}`,
    `L${p(x + r, y + h)}`,
    `C${p(x + k, y + h)} ${p(x, y + h - k)} ${p(x, y + h - r)}`,
    `L${p(x, y + r)}`,
    `C${p(x, y + k)} ${p(x + k, y)} ${p(x + r, y)}Z`,
  ].join('');
}

async function dataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Renders printed-page markup to a canvas at DPI, cropped to the given area (in mm).
 * The markup is drawn through an SVG foreignObject, with icons inlined since SVG images cannot load resources.
 */
async function rasterize(
  markup: string,
  page: { width: number; height: number },
  crop: { x: number; y: number; width: number; height: number },
) {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const icons = new Map<string, Promise<string>>();
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src')!;
    if (!icons.has(src)) icons.set(src, dataUrl(src).catch(() => ''));
    img.setAttribute('src', await icons.get(src)!);
  }
  const root = doc.createElement('div');
  const style = doc.createElement('style');
  style.textContent = sheetCss;
  root.append(style, ...doc.body.childNodes);

  const cssWidth = page.width * CSS_PX_PER_MM;
  const cssHeight = page.height * CSS_PX_PER_MM;
  const scale = DPI / 96;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cssWidth * scale}" height="${cssHeight * scale}" ` +
    `viewBox="0 0 ${cssWidth} ${cssHeight}"><foreignObject width="100%" height="100%">` +
    new XMLSerializer().serializeToString(root) +
    '</foreignObject></svg>';
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const px = (mm: number) => Math.round((mm * DPI) / 25.4);
  const canvas = document.createElement('canvas');
  canvas.width = px(crop.width);
  canvas.height = px(crop.height);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, -px(crop.x), -px(crop.y));
  return canvas;
}

const png = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b))) : reject(new Error('PNG failed'))),
      'image/png',
    ),
  );

function thumbnail(source: HTMLCanvasElement, width = 400) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((source.height * width) / source.width);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const baseDisplay = (id: string, zOrder: number, groupTag: string) => ({
  id,
  name: null,
  angle: 0,
  scale: { x: 1, y: 1 },
  skew: { x: 0, y: 0 },
  pivot: { x: 0, y: 0 },
  localSkew: { x: 0, y: 0 },
  zOrder,
  groupTags: [groupTag],
  layerTag: LAYER,
  layerColor: LAYER,
  visible: true,
  originColor: '#000000',
  enableTransform: true,
  visibleState: true,
  lockState: false,
  resourceOrigin: '',
  customData: { tabBreaks: {}, startPoint: {} },
  rootComponentId: '',
  minCanvasVersion: '0.0.0',
  alpha: 1,
  fill: { paintType: 'color', visible: false, color: 0, alpha: 1 },
  effects: [],
});

const stroke = (visible: boolean) => ({
  paintType: 'color',
  visible,
  color: 0,
  alpha: 1,
  width: 1,
  cap: 'butt',
  join: 'miter',
  miterLimit: 4,
  alignment: 0.5,
});

function cutPath(id: string, zOrder: number, groupTag: string, x: number, y: number, w: number, h: number) {
  return {
    ...baseDisplay(id, zOrder, groupTag),
    type: 'PATH',
    x: round(x),
    y: round(y),
    // The path data is in canvas coordinates, so it needs no offset
    offsetX: 0,
    offsetY: 0,
    graphicX: 0,
    graphicY: 0,
    lockRatio: false,
    isClosePath: true,
    stroke: stroke(true),
    width: round(w),
    height: round(h),
    isFill: false,
    lineColor: 0x27a0f3,
    fillColor: '#27a0f3',
    points: [],
    fillRule: 'nonzero',
    isCompoundPath: false,
    dPath: roundedRect(x, y, w, h, Math.min(CORNER_RADIUS, w / 4, h / 4)),
  };
}

function bitmap(
  id: string,
  groupTag: string,
  resourcePath: string,
  area: { x: number; y: number; width: number; height: number },
  pixels: { width: number; height: number },
) {
  return {
    ...baseDisplay(id, 1, groupTag),
    type: 'BITMAP',
    x: round(area.x),
    y: round(area.y),
    scale: { x: round(area.width / pixels.width), y: round(area.height / pixels.height) },
    offsetX: round(area.x),
    offsetY: round(area.y),
    lockRatio: true,
    isClosePath: false,
    stroke: stroke(false),
    width: round(area.width),
    height: round(area.height),
    isFill: true,
    filterList: [],
    grayValue: [0, 255],
    sharpness: 50,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tone: 0,
    colorInverted: false,
    colorInvertedFillTransparent: false,
    colorInvertedTransparentColor: 'black',
    filterAttrsMap: {
      emboss: { strength: 5 },
      halftone: { radius: 4, angle: 45 },
      binary: { threshold: 128 },
      sketch: { strength: 2 },
      dot: { angle: 45, scale: 14 },
    },
    mask: null,
    originWidth: pixels.width,
    originHeight: pixels.height,
    modifyData: {},
    currentUrl: '',
    dpi: { dpiX: DPI, dpiY: DPI },
    isGray: false,
    originAutoAdjust: null,
    autoStrength: 0,
    resourcePath,
    opacity: 1,
    filterList_V2: [],
  };
}

const resourceMeta = (file: string) =>
  json({
    ref: `resources/${file}`,
    metadata: { kind: 'image', source: { type: 'workspace', value: file }, mimeType: 'image/png' },
  });

/** Builds the xTool Studio project for a sheet, one canvas per page */
export async function exportXTool(sheet: Sheet, stickers: Record<string, Sticker>): Promise<Blob> {
  const pages = paginate(sheet, stickers);
  const paper = paperSize(sheet.settings);
  const grid = gridFor(sheet.settings);
  const d = dimensionsOf(sheet.settings);

  // The image covers the area between the registration markers' outer corners, so it can be snapped to them
  const sheetWidth = 2 * d.sheetPadding + grid.columns * d.cellWidth + (grid.columns - 1) * d.gapX;
  const sheetHeight = 2 * d.sheetPadding + grid.rows * d.cellHeight + (grid.rows - 1) * d.gapY;
  const area = {
    x: d.pageMargin + d.markerInset,
    y: d.pageMargin + d.markerInset,
    width: sheetWidth - 2 * d.markerInset,
    height: sheetHeight - 2 * d.markerInset,
  };

  const profiles = {
    engrave: shortId('profile'),
    activeKnife: shortId('profile'),
    activeDisc: shortId('profile'),
    knife: shortId('profile'),
  };
  const files: Zippable = {};
  const canvasIds: string[] = [];
  const processing: Record<string, unknown> = {};
  let cover: Uint8Array | null = null;

  for (const [index, slots] of pages.entries()) {
    const canvasId = uuid();
    canvasIds.push(canvasId);
    const groupTag = `g-${uuid()}`;

    const markup = renderToStaticMarkup(
      createElement(PrintedPage, { sheet, slots, page: index + 1, pageCount: pages.length }),
    );
    const canvas = await rasterize(markup, paper, area);
    const image = `${sheet.id}-page-${index + 1}.png`;
    files[`resources/${image}`] = [await png(canvas), { level: 0 }];
    files[`resources/${image}.meta.json`] = resourceMeta(image);
    if (!cover) cover = await png(thumbnail(canvas));

    const bitmapId = uuid();
    const cuts = slots.flatMap((slot, i) => {
      if (slot.kind !== 'sticker') return [];
      const column = i % grid.columns;
      const row = Math.floor(i / grid.columns);
      const x = d.pageMargin + d.sheetPadding + column * (d.cellWidth + d.gapX);
      const y = d.pageMargin + d.sheetPadding + row * (d.cellHeight + d.gapY);
      return [cutPath(uuid(), 2 + i, groupTag, x, y, d.cellWidth, d.cellHeight)];
    });
    const displays = [bitmap(bitmapId, groupTag, `resources/${image}`, area, canvas), ...cuts];

    files[`canvases/${canvasId}.json`] = json({
      id: canvasId,
      title: pages.length > 1 ? `Page ${index + 1}` : sheet.name,
      hidden: false,
      layerData: { [LAYER]: { name: LAYER.toUpperCase(), order: 1, visible: true } },
      groupData: {
        [groupTag]: {
          groupName: '',
          groupTag,
          visible: true,
          enableTransform: true,
          zOrder: displays.length + 1,
          rotation: 0,
        },
      },
      extendInfo: {
        version: '2.16.1',
        minCanvasVersion: '0.0.0',
        displayProcessConfigMap: {},
        rulerPluginData: { rulerGuide: [] },
        type: '2d',
      },
      chunkLayout: { displayCount: displays.length, chunkCount: 1, chunkIndexes: [0] },
    });
    files[`canvases/${canvasId}/displays-0.json`] = json({ canvasId, chunkIndex: 0, displays });

    const binding = (profile: string, displayIds: string[], extra = {}) => ({
      bindingId: shortId('binding'),
      canvasId,
      mode: 'KNIFE_COMBINE',
      baseProfileId: profile,
      ...extra,
      displayIds,
    });
    const patchId = shortId('patch');
    const knifeBinding = binding(profiles.knife, cuts.map((c) => c.id), { patchIds: [patchId] });
    processing[canvasId] = {
      id: canvasId,
      activeMode: 'KNIFE_COMBINE',
      modes: {
        KNIFE_COMBINE: {
          // The page image is only a guide for lining up with the printout; it is not processed
          ignoredDisplayIds: [bitmapId],
          data: {
            material: 0,
            pathPlanning: 'auto',
            fillPlanning: 'separate',
            thickness: null,
            focalLen: null,
            focalLength: null,
            perimeter: null,
            diameter: null,
            boardSelect: 'METAL',
          },
          profileRefs: Object.values(profiles),
          patches: {
            [patchId]: {
              id: patchId,
              profileId: profiles.knife,
              source: 'custom',
              overrides: { ...KNIFE, processHead: 'PASSIVE_KNIFE' },
            },
          },
          bindings: [
            binding(profiles.engrave, [bitmapId]),
            binding(profiles.activeKnife, [], { shadowOf: knifeBinding.bindingId }),
            binding(profiles.activeDisc, [], { shadowOf: knifeBinding.bindingId }),
            knifeBinding,
          ],
        },
      },
    };
  }

  const now = Date.now();
  const projectId = uuid();
  files['.format'] = strToU8('v2');
  files['meta/persistence-meta.json'] = json({ schemaVersion: '2.0.0', protocol: 'xcs-workspace-v2' });
  files['project.json'] = json({
    __v2__: true,
    version: '2.0.0',
    schemaMeta: { schemaVersion: '2.1.0', format: 'directory' },
    projectId,
    projectTraceID: projectId,
    projectName: sheet.name,
    activeCanvasId: canvasIds[0],
    activeDeviceId: 'ZH009-1',
    versionInfo: {
      source: 'web',
      appVersion: '1.7.24',
      savedAt: now,
      minRequiredVersion: '2.6.0',
      appMinRequiredVersion: '',
      webMinRequiredVersion: '',
    },
    created: now,
    modify: now,
    modules: { canvases: canvasIds, devices: ['ZH009-1'] },
    cover: 'resources/project-cover.png',
    customProjectData: { projectTraceID: projectId },
  });
  files['profiles.json'] = json({
    profiles: {
      [profiles.engrave]: {
        id: profiles.engrave,
        processingType: 'FILL_VECTOR_ENGRAVING',
        values: {
          power: 1,
          speed: 80,
          repeat: 1,
          laser: 'laser_20W',
          density: 60,
          bitmapScanMode: 'zMode',
          processHead: 'LASER',
          defocus: false,
          defocus_distance: 3,
          enableKerf: false,
          kerfDistance: 0,
        },
      },
      [profiles.activeKnife]: {
        id: profiles.activeKnife,
        processingType: 'ACTIVE_KNIFE_CUT',
        values: { cutValue: 45, speed: 10, repeat: 1, cut_times: 1, processHead: 'ACTIVE_CUT' },
      },
      [profiles.activeDisc]: {
        id: profiles.activeDisc,
        processingType: 'ACTIVE_DISC_PRESS',
        values: { cutValue: 45, speed: 10, repeat: 1, processHead: 'ACTIVE_DISC' },
      },
      [profiles.knife]: {
        id: profiles.knife,
        processingType: 'KNIFE_CUTTING',
        values: { cutValue: 35, speed: 10, repeat: 1, processHead: 'PASSIVE_KNIFE' },
      },
    },
  });
  files['devices/device-ZH009-1.json'] = json({
    id: 'ZH009-1',
    deviceCode: 'ZH009',
    extId: 'M1Ultra',
    extName: 'M1 Ultra',
    power: [20],
    processing,
  });
  if (cover) {
    files['resources/project-cover.png'] = [cover, { level: 0 }];
    files['resources/project-cover.png.meta.json'] = resourceMeta('project-cover.png');
  }

  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
