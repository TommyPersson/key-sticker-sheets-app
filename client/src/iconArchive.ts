import { unzip, type UnzipFileInfo } from 'fflate';

/** File types the server accepts as icons */
export const ICON_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
/** The server's upload limit per icon */
const MAX_ICON_BYTES = 2 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();
const baseNameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export const isZip = (file: File) =>
  /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

/** Makes an archive entry's name acceptable as an icon file name on the server */
function iconFileName(path: string) {
  const name = baseNameOf(path)
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^[^A-Za-z0-9]+/, '');
  const ext = extensionOf(name);
  return name.length > 128 ? name.slice(0, 128 - ext.length) + ext : name;
}

const wanted = (entry: UnzipFileInfo) => {
  const name = baseNameOf(entry.name);
  return (
    !entry.name.endsWith('/') &&
    !entry.name.split('/').includes('__MACOSX') &&
    !name.startsWith('.') &&
    ICON_EXTENSIONS.includes(extensionOf(name)) &&
    entry.originalSize <= MAX_ICON_BYTES
  );
};

/**
 * Extracts the supported icon files from a zip archive, flattening its folders.
 * Only wanted entries are decompressed, so oversized or unrelated files cost nothing.
 */
export async function extractIcons(zip: File): Promise<{ files: File[]; skipped: number }> {
  const data = new Uint8Array(await zip.arrayBuffer());
  let entries = 0;
  const contents = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(
      data,
      {
        filter: (entry) => {
          if (!entry.name.endsWith('/')) entries++;
          return wanted(entry);
        },
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    ),
  );

  const files: File[] = [];
  const names = new Set<string>();
  for (const [path, bytes] of Object.entries(contents).sort(([a], [b]) => a.localeCompare(b))) {
    const name = iconFileName(path);
    // Same name in different archive folders: keep the first
    if (!name || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    // fflate always returns plain (not shared) buffers
    files.push(new File([bytes as Uint8Array<ArrayBuffer>], name, { type: MIME_TYPES[extensionOf(name)] }));
  }
  return { files, skipped: entries - files.length };
}
