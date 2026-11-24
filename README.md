# Zclassic website

The community homepage for [zclassic.org](https://zclassic.org/), built with plain HTML and CSS. **No JavaScript**: there are no scripts, no build step, no packages and no external fonts or libraries.

## Features

- Responsive layouts for phones, tablets and desktops (320–2400 px).
- Light and dark themes that follow the visitor's system setting (`prefers-color-scheme`).
- A scalable copper SVG logo used in the header, footer and hero coin.
- One download link per platform for the wallet, plus command-line tools and checksums.
- 44 px touch targets, visible keyboard focus, a skip link, and reduced-motion and print styles.
- A 1200 × 630 link preview image for social media and chat apps.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | The whole page: content, links and inline SVG illustrations |
| `frontend-zcl/style.css` | Styling, themes and responsive rules, using native system fonts |
| `frontend-zcl/zclassic.svg` | Zclassic logo |
| `frontend-zcl/cc0.svg` | CC0 badge in the footer |
| `frontend-zcl/og-image.png` | 1200 × 630 link preview image |
| `frontend-zcl/favicon.svg`, `favicon-96x96.png`, `favicon.ico`, `apple-touch-icon.png` | Browser and home-screen icons |
| `frontend-zcl/site.webmanifest`, `web-app-manifest-*.png` | App name and icons |
| `tools/check_frontend.py` | Standard-library checks (Python 3.9+, no dependencies) |

Keep `CNAME`, `LICENSE` and the linked PDF documents in place.

The root `style.css`, `zclassic.png`, `zclassic.ico` and `cc0.png` are no longer loaded by this page but are kept on purpose: old bookmarks, cached pages and other sites may still point at those URLs. The check script makes sure they stay byte-identical to upstream.

## Releasing a new wallet version

All release data is plain links in `index.html`. Search and replace the old version (for example `v2.1.2-beta13`) with the new one in `index.html`, then run the checks below.

## Local preview

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. You can also open `index.html` directly; keep the `frontend-zcl` folder beside it.

## Checks

```sh
python3 tools/check_frontend.py
python3 tools/check_frontend.py --base origin/main
```

The first command checks that the page has no scripts, that every local file and `#anchor` exists, the manifest paths, and that HTML + CSS stay under a 22 KiB gzip budget. With `--base`, it also checks that download links, Z23 commands, social tags and the compatibility files match the given upstream commit.

## Contributing

1. Fork [ZclassicCommunity/zclassicorg.github.io](https://github.com/ZclassicCommunity/zclassicorg.github.io) and create a branch.
2. Edit `index.html` and `frontend-zcl/style.css`. Do not add JavaScript.
3. Run the checks, then preview in a phone-sized and a desktop window, in both light and dark system themes.
4. Open a pull request against `main`.

## Notices

The page keeps the [CC0 public domain notice](https://creativecommons.org/publicdomain/zero/1.0/); the badge comes from the [official Creative Commons downloads](https://creativecommons.org/mission/downloads/). The repository's MIT `LICENSE` is unchanged. Icons were generated with [RealFaviconGenerator](https://realfavicongenerator.net/).
