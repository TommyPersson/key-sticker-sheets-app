# Key Sticker Sheets

Design and print sticker sheets for 1.5u keyboard keycaps. This is the app version of the `test.html` PoC in the parent directory.

- **client/**: React + Vite + MUI (TypeScript)
- **server/**: Node/Express backend that stores sheets and icons as files under `DATA_DIR`

## Running with Docker

```bash
docker compose up -d --build
```

Then open http://localhost:3000. All data lives in the `sticker-data` volume mounted at `/data`:

```
/data/sheets/<id>.json        one file per sheet
/data/icons/<folder>/<file>   icon library (svg, png, jpg, webp, gif)
```

On first start, when `/data/sheets` or `/data/icons` don't exist yet, they're seeded from `server/seed` (the PoC's icons and a sheet with the PoC's stickers).

To use a host directory instead of a named volume, use `-v ./data:/data`. The container runs as the `node` user (uid 1000), so the directory must be writable by that user.

## Development

```bash
npm install                # root (concurrently)
npm run install:all        # server + client deps
npm run dev                # backend on :3000, Vite on :5173 (proxies /api and /icons)
```

During development, data is stored in `server/data`.

## Features

- Multiple sheets: create, duplicate, delete, export to JSON, and import JSON (either an exported sheet or the PoC's array format)
- WYSIWYG 5×10 grid in physical units (26×17 mm cells, 2 mm gaps, corner registration markers), the same as the PoC
- Click a sticker to edit it, click an empty slot to add one, drag to reorder, arrow keys to move the selection, Delete to remove it
- Icon library with search and folder filter, upload to any folder, and delete
- **Skip slots**: leaves the first N slots empty so you can reuse partially used sticker paper
- **Outlines**: optionally prints a thin border around each sticker
- Autosave (debounced), undo/redo (Ctrl+Z / Ctrl+Y), Ctrl+S to save right away
- Print uses the browser's print dialog and puts 50 stickers on each page

## API

| Method | Path | |
|---|---|---|
| GET | `/api/sheets` | list sheet summaries |
| POST | `/api/sheets` | create a sheet |
| GET/PUT/DELETE | `/api/sheets/:id` | read, replace, or delete a sheet |
| GET | `/api/icons` | list icons |
| PUT | `/api/icons/:folder/:name` | upload an icon (raw request body) |
| DELETE | `/api/icons/:folder/:name` | delete an icon |
| GET | `/icons/:folder/:name` | serve an icon file |

There's no authentication. Only run it on a trusted network.
