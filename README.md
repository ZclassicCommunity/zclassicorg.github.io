# Zclassic website

A responsive community frontend for [zclassic.org](https://zclassic.org/), built with HTML, CSS, and vanilla JavaScript. It runs as a static website with no build step, package installation, or external UI libraries.

## Features

- Responsive layouts for mobile, tablet, and desktop.
- Light and dark themes that follow the system until a preference is saved, with changes shared across open tabs.
- A scalable copper SVG logo used in the header, footer, and hero coin.
- Wallet platform tabs, resource search and category filters, and a copyable Z23 command.
- Keyboard navigation with focus recovery at mobile breakpoints, 44px controls, and reduced motion support.
- Content and wallet links remain available when JavaScript is disabled or the enhancement script fails to load.
- PNG, SVG, ICO, Apple touch, and web manifest icons generated with [RealFaviconGenerator](https://realfavicongenerator.net/).

## Repository layout

Keep `index.html` and `README.md` at the repository root. Put the frontend assets in `frontend-zcl/`.

| Path | Purpose |
| --- | --- |
| `index.html` | Page content, inline SVG illustrations, and a small theme bootstrap |
| `README.md` | Setup and contribution instructions |
| `frontend-zcl/style.css` | Page styling and responsive rules, using native system fonts |
| `frontend-zcl/app.js` | Deferred navigation, theme, wallet, search, and clipboard enhancements |
| `frontend-zcl/zclassic.svg` | Zclassic logo |
| `frontend-zcl/cc0.svg` | Linked CC0 badge in the footer |
| `frontend-zcl/favicon.svg` | Scalable browser icon |
| `frontend-zcl/favicon-96x96.png` | 96 × 96 browser icon |
| `frontend-zcl/favicon.ico` | ICO browser icon |
| `frontend-zcl/apple-touch-icon.png` | 180 × 180 Apple touch icon |
| `frontend-zcl/site.webmanifest` | App name, icon locations, and launch settings |
| `frontend-zcl/web-app-manifest-192x192.png` | 192 × 192 app icon |
| `frontend-zcl/web-app-manifest-512x512.png` | 512 × 512 app icon |
| `tools/check_frontend.py` | Standard-library asset, size, and compatibility checks |
| `tools/browser-check.cjs` | Optional Chromium, Firefox, and WebKit interaction and accessibility checks |
| `package.json`, `package-lock.json` | Pinned development tools; not needed to serve the website |

Existing repository files, including `CNAME` and the linked PDF documents, should stay in place.

## Local preview

From the directory containing `index.html`, run:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/) in your browser. Stop the server with `Ctrl+C`.

You can also open `index.html` directly to preview the page. Use the local server when checking favicon and manifest behavior. Keep the `frontend-zcl` folder beside `index.html` in either case.

## Checks

Run the asset and size checks before committing. The checker requires Python 3.9 or newer and has no external dependencies. Its 22 KiB gzip budget includes HTML, CSS, and JavaScript:

```sh
python3 tools/check_frontend.py
```

For a repository checkout, compare compatibility files and protected download destinations with the upstream baseline:

```sh
python3 tools/check_frontend.py --base ca4c11b672cdba8097ae13c2390e188e9f5c667b
```

Optional browser checks use Node 22 or newer and the pinned development dependencies:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

The suite starts its own local server. It checks responsive widths, both themes, automated accessibility, keyboard focus, original wallet downloads, search, clipboard fallbacks, subdirectory hosting, direct-file previews, reduced motion, and unavailable JavaScript or storage. To check one installed browser, set `ZCL_BROWSERS=chromium`, `firefox`, or `webkit`.

These tools are for development only. The static site needs no npm installation or build command. Keep generated reports and test output outside the published repository.

## Editing the website

Edit page text and resource destinations in `index.html`, interactions in `frontend-zcl/app.js`, and colors, spacing, typography, breakpoints, and animations in `frontend-zcl/style.css`.

The stylesheet uses native system fonts. No webfont files, embedded font payloads, or font service requests are shipped.

Telegram and the main Zclassic repository link are available through the footer icons. Their duplicate entries have been removed from Resources. Links to specific tools, source repositories, and wallet downloads remain available where relevant.

## Favicons

The HTML head includes these paths:

```html
<link rel="stylesheet" href="./frontend-zcl/style.css">
<link rel="icon" type="image/png" href="./frontend-zcl/favicon-96x96.png" sizes="96x96">
<link rel="icon" type="image/svg+xml" href="./frontend-zcl/favicon.svg">
<link rel="shortcut icon" href="./frontend-zcl/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="./frontend-zcl/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Zclassic">
<link rel="manifest" href="./frontend-zcl/site.webmanifest">
```

The manifest's icon paths are relative to the manifest file, so they point to the PNG files in the same folder. Its `start_url` and `scope` use `../` to point back to the homepage. These relative paths also support a preview hosted under a repository subdirectory.

When regenerating favicons, replace the seven generated favicon files in `frontend-zcl/` and retain this folder arrangement. If the generator produces root paths such as `/web-app-manifest-192x192.png`, update them to `./web-app-manifest-192x192.png` in `site.webmanifest`.

## Contributing through GitHub

1. Fork [ZclassicCommunity/zclassicorg.github.io](https://github.com/ZclassicCommunity/zclassicorg.github.io) and create a branch for your changes.
2. Commit the updated `index.html`, this `README.md`, the complete `frontend-zcl/` folder, and any updated development tools together. Do not upload review reports or a ZIP to the published website.
3. Keep the repository's existing domain configuration and documents. Commit the new asset paths and their files together.
4. Preview the homepage on mobile and desktop, check both themes, and confirm that all frontend assets load.
5. Open a pull request against the community repository's `main` branch. Maintainers can review and publish the change through the repository's existing hosting setup.

This homepage uses `frontend-zcl/style.css`. Keep the original root-level `style.css`, `zclassic.png`, `zclassic.ico`, and `cc0.png` unchanged for existing links and consumers. The page uses the new SVG logo and CC0 badge in `frontend-zcl/` without deleting these compatibility assets.

## Notices

The homepage's [CC0 public domain notice](https://creativecommons.org/publicdomain/zero/1.0/) is preserved. The CC0 badge comes from the [official Creative Commons downloads](https://creativecommons.org/mission/downloads/).

The repository’s existing MIT `LICENSE`, including its original copyright year, is unchanged. The previous webfont payloads and their accompanying notices have been removed together because the page now uses system fonts.

## References

- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Manifest icon path reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)
- [GitHub pull request guide](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)
