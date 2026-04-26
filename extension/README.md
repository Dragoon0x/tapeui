# TAPE browser extension

Inject TAPE into any site you visit, even sites that don't ship the SDK.

## Build & install

1. From the repo root, run `npm install && npm run build`.
2. Copy the built vanilla bundle into this folder:

   ```bash
   cp dist/vanilla.js extension/vanilla.js
   ```

3. Open Chrome and go to `chrome://extensions`.
4. Toggle **Developer mode** (top-right).
5. Click **Load unpacked** and select the `extension/` folder.
6. Pin the extension. Click its icon on any page to open the TAPE panel, or press `Alt+T`.

## What it does

`content.js` runs on every page (idle). When you toggle the extension, it injects the bundled vanilla SDK into the page's main world and opens the TAPE panel. Recording, vision capture, source linking (when the page uses React/Vue/Svelte in dev mode), and all exporters work the same way they do in the React/Vanilla integrations.

## Permissions

- `activeTab` — only the active tab is touched.
- `scripting` — needed to inject the SDK on demand.
- `storage` — reserved for future preferences.
- `<all_urls>` — needed because the whole point is to TAPE any site you choose.

No data leaves the browser. Everything is captured locally and only exported when you copy or download.
