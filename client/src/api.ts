import type { IconInfo, LibrarySticker, Sheet, SheetSummary, Sticker } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  listSheets: () => request<SheetSummary[]>('/api/sheets'),
  getSheet: (id: string) => request<Sheet>(`/api/sheets/${encodeURIComponent(id)}`),
  createSheet: (sheet: Partial<Sheet>) => request<Sheet>('/api/sheets', json('POST', sheet)),
  updateSheet: (sheet: Sheet) => request<Sheet>(`/api/sheets/${encodeURIComponent(sheet.id)}`, json('PUT', sheet)),
  deleteSheet: (id: string) => request<void>(`/api/sheets/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listStickers: () => request<LibrarySticker[]>('/api/stickers'),
  saveSticker: (sticker: Sticker) =>
    request<Sticker>(`/api/stickers/${encodeURIComponent(sticker.id)}`, json('PUT', sticker)),
  deleteSticker: (id: string) =>
    request<{ affectedSheets: string[] }>(`/api/stickers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listIcons: () => request<IconInfo[]>('/api/icons'),
  uploadIcon: (folder: string, file: File) =>
    request<IconInfo>(`/api/icons/${encodeURIComponent(folder)}/${encodeURIComponent(file.name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    }),
  deleteIcon: (icon: IconInfo) =>
    request<void>(`/api/icons/${encodeURIComponent(icon.folder)}/${encodeURIComponent(icon.name)}`, {
      method: 'DELETE',
    }),
};

export const iconUrl = (path: string) => `/icons/${path.split('/').map(encodeURIComponent).join('/')}`;
