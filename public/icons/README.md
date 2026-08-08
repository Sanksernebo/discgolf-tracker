# PWA icons

Drop three PNGs here with these exact filenames:

- `icon-192.png` — 192×192 (used by Android home screen and notification badge)
- `icon-512.png` — 512×512 (used by Android splash screen)
- `icon-512-maskable.png` — 512×512 with padding for Android's adaptive icon
  crop (safe zone ≈ centre 80%)
- `apple-touch-icon.png` — 180×180 (used by iOS when the site is added to
  the home screen; if omitted, iOS uses a screenshot which looks bad)

The site references these via `/manifest.webmanifest` and via the
`<link rel="apple-touch-icon">` tag in the root layout. Missing icons don't
break anything visible in the browser but the home-screen icon will fall
back to a generic silhouette on iOS.

For a quick placeholder, run a design tool like RealFaviconGenerator on
the ⛳ emoji rendered at 512×512, then drop the resulting files here.
