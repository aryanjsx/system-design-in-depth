# Contributing to System Design In-Depth

Welcome! System Design In-Depth is a zero-build vanilla JS learning platform designed to be explored directly from the file system.

## Prerequisites
- A modern web browser
- A text editor
- (Optional but recommended) Node.js for running validation scripts

## Running Locally
Since this project uses no build tools or bundlers, running it locally is incredibly simple:
1. Clone the repository.
2. Open `index.html` directly in your browser (`file://` protocol), OR serve the directory with any basic static HTTP server (e.g., `python -m http.server`, `npx serve`).

## Content Contribution Guidelines
If you are contributing content (modules, units):
- **Voice and Depth:** Match the existing voice and technical depth.
- **Unit Requirements:** Every unit needs substantial content, 3-5 key takeaways, and 2-4 further reading items.
- **Validation:** Always run `node tools/validate.js` locally before submitting to ensure data integrity.

## Code Contribution Guidelines
If you are contributing to the platform code:
- **No Build Step:** No bundlers, compilers, or npm runtime dependencies.
- **Tech Stack:** Vanilla HTML/CSS/JS, ES2020.
- **Modules:** Use IIFE modules assigned to `window.*`.
- **Data Files:** Must be plain `.js` files that assign to window globals (e.g., `window.DATA_NAME = ...`). This ensures they work via `file://` protocol without CORS issues.
- **State:** State persists only in `localStorage`.
- **Cache-busting:** After changing any JS, CSS or data file, run `node tools/stamp-assets.js`. It rewrites the `?v=<hash>` on every script/stylesheet tag in `index.html` and `projects/index.html`. `_headers` caches those files as immutable for a year, so an unstamped change would not reach returning visitors. The validator fails if stamps are stale.

## PR Checklist
Before submitting a Pull Request, ensure:
- [ ] `node tools/stamp-assets.js` has been run after your last JS/CSS/data change
- [ ] `node tools/validate.js` exits 0 without errors
- [ ] No new runtime dependencies were introduced
- [ ] Tested and working in a browser from the `file://` protocol
- [ ] Content matches the voice/depth of existing units
