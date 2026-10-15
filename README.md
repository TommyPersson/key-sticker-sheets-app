# Key Sticker Sheets

Design and print sticker sheets for 1.5u keyboard keycaps. This is the app version of the `test.html` PoC in the parent directory.

- **client/**: React + Vite + MUI (TypeScript)
- **server/**: Node/Express backend that stores the sticker library, sheets and icons as files under `DATA_DIR`

## Running with Docker

```bash
docker compose up -d --build
```

Then open http://localhost:3000. All data lives in the `sticker-data` volume mounted at `/data`:

```
/data/stickers.json           the sticker library
/data/sheets/<id>.json        one file per sheet, referring to library stickers by id
/data/icons/<folder>/<file>   icon library (svg, png, jpg, webp, gif)
```

On first start, when `/data/sheets` or `/data/icons` don't exist yet, they're seeded from `server/seed` (the PoC's icons and a sheet with the PoC's stickers).

Sheets from earlier versions embedded their stickers. On startup they're migrated automatically: their stickers move into the library (identical stickers become one entry) and the sheets keep references to them.

To use a host directory instead of a named volume, use `-v ./data:/data`. The container runs as the `node` user (uid 1000), so the directory must be writable by that user.

## Development

```bash
npm install                # root (concurrently)
npm run install:all        # server + client deps
npm run dev                # backend on :3000, Vite on :5173 (proxies /api and /icons)
```

During development, data is stored in `server/data`.

### Storybook

Component stories, for checking visuals without the app or the server:

```bash
cd client
npm run storybook          # http://localhost:6006
npm run build-storybook    # static build in client/storybook-static
```

Stories live in `client/src/stories`: every sticker layout per size (with editable content and edge cases), the sheet editor (interactive: select, swap, move, remove) and printed page, and the library, sticker editor, sheet list and page setup panels. Sample data is in `fixtures.ts`; icons are served from `server/seed/icons`.

## Features

- The sheet list and the sticker library are panels floating over the left and right of the workspace. Drag the library's left edge to widen or narrow it, one card column at a time (2–8 columns, remembered). Selecting a sticker opens its editor in a floating panel next to the library; close it with ✕ or Esc.
- **Key sizes**: 1.5U (26 × 17 mm) and 1U (17 × 17 mm) stickers. Each size has its own sticker library, and each sheet holds stickers of one size: pick it from the New sheet button's menu, or change it from the sheet's menu in the sheet list (a non-empty sheet is cleared after a warning, and the change can be undone while the sheet is open). The sheet's sticker width follows its size. The sheet list and toolbar show each sheet's size, and the library title shows the size it lists.
- **Sticker library**: every sticker lives in its size's library, and sheets place stickers from it. A sticker can be placed several times and on several sheets, and editing it updates every placement. Stickers can have a category. The library has search (including categories), filters (on this sheet, not on this sheet, unused) and a quick filter per category, which combines with the other filters. The library is grouped into collapsible sections per category (collapsed sections are remembered). Drag a sticker onto the sheet to insert it before the slot you drop it on, or onto an empty slot to append it; double-click to append.
- Stickers selected on a sheet can be removed from that sheet (they stay in the library) or turned into a separate copy, to vary one placement without changing the others. Deleting a sticker from the library also removes it from every sheet that uses it, after a confirmation that names those sheets.
- Multiple sheets: create, duplicate (the copy places the same library stickers), delete, export to JSON, and import JSON (either an exported sheet or the PoC's array format). Exported files embed the full stickers, so they work in another installation. Importing reuses identical library stickers (same content, size and layout) and adds the rest; imported stickers get the sheet's size, and PoC files import as 1.5U.
- WYSIWYG preview in physical units (26×17 mm cells, 2 mm gaps, corner registration markers), the same as the PoC
- **Page setup** for each sheet: paper size (A4, A5, A3, Letter, Legal), portrait or landscape, and every dimension in mm: sticker width (defaulting to the sheet's key size) and height, horizontal and vertical gaps, page margin, sheet padding, and the registration markers' inset and length (0 hides them). The defaults match the PoC. The grid adapts to fit as many stickers as the paper holds (A4 portrait with the defaults: 6×13). The preview shows the paper, and printing uses the same paper size.
- Each page (preview and print) has two lines in its bottom margin: sheet name, paper and page number, then sticker size, gap, grid, page margin, and where the first sticker and the markers sit. Use them to check print scale and set up cutters.
- Click a sticker to edit it, click an empty slot to create a new one, drag onto another sticker to swap the two, or into the gap between two stickers to move it there (an empty slot moves it to the end), arrow keys to move the selection, Delete to remove it from the sheet
- **Sticker layouts**: each sticker picks a layout in the sticker editor, which previews the sticker in every layout of its size. A layout places the three fixed components (the two text lines, the icon and the shortcut) at any of nine anchor points (corners, edge centres, centre), stacking components that share an anchor, optionally side by side, and may leave a component out. Each size offers "Classic" (the default; text top left, icon top right, shortcut bottom left, the original design), "Centered text" and "Centered icon" (each with the shortcut bottom centre); 1U also has "Icon above text" (icon top, text centre, shortcut bottom) and "Large icon" (an 8 mm icon above the shortcut). A layout can enlarge the icon; otherwise the components have a fixed size. Layouts are defined in `client/src/layouts.ts`.
- Icon library grouped by collapsible folders, with search and folder filter. Create (and delete empty) folders, upload into a folder from its header or by dropping files on it (zip archives are unpacked, keeping the supported image files), and rename, move to another folder or delete icons from their hover menu (renaming and moving update the stickers using the icon). Open it from the sticker editor to choose an icon, or from the image button in the library title bar to manage icons.
- **Skip slots** (in page setup): leaves the first N slots empty so you can reuse partially used sticker paper
- **Outlines** (in page setup): optionally prints a thin border around each sticker
- Autosave (debounced), undo/redo for sheet layout and sticker edits (Ctrl+Z / Ctrl+Y), Ctrl+S to save right away. Undoing the creation of a sticker removes it from the sheet but leaves it in the library, where the Unused filter finds it.
- Print uses the browser's print dialog, with one page per paper sheet
- **xTool export** downloads an xTool Studio project (`.xs`) for print-then-cut on the M1 Ultra. Each page becomes a canvas with a 300 dpi image of the printed page, cropped to the registration markers' outer corners so it can be lined up with the printout in the camera view (the image itself is not processed), plus a 2 mm rounded knife-cut outline around each placed sticker (passive knife, force 70, speed 40, 2 passes). Skipped and empty slots are not cut, so the rest of the sheet stays usable.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/sheets` | list sheet summaries |
| POST | `/api/sheets` | create a sheet |
| GET/PUT/DELETE | `/api/sheets/:id` | read, replace, or delete a sheet |
| GET | `/api/stickers` | list library stickers, each with the ids of the sheets using it |
| PUT | `/api/stickers/:id` | create or replace a library sticker |
| DELETE | `/api/stickers/:id` | delete a library sticker and remove it from all sheets |
| GET | `/api/icons` | list icons |
| PUT | `/api/icons/:folder/:name` | upload an icon (raw request body) |
| POST | `/api/icons/:folder/:name/rename` | rename and/or move an icon (`{ "name": "new.svg", "folder": "other" }`, both optional), updating stickers that use it |
| DELETE | `/api/icons/:folder/:name` | delete an icon |
| GET | `/api/icon-folders` | list icon folders, including empty ones |
| POST | `/api/icon-folders` | create an empty folder (`{ "name": "..." }`) |
| DELETE | `/api/icon-folders/:folder` | delete an empty folder |
| GET | `/icons/:folder/:name` | serve an icon file |

There's no authentication. Only run it on a trusted network.
