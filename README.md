# ALGO/COLLAGE

**Collect. Cut. Compose.**

A browser collage studio built on [ALGO/ART](https://github.com/southernadd-cmyk/algoart). Collect free images or upload your own. One seeded ALGO/ART output selects regions and subjects; another output assembles the pieces.

**[Open the live studio →](https://southernadd-cmyk.github.io/algoCollage/)**

![Algo Collage studio](docs/studio.jpg)

## Subject-aware cutting — 0.2

- **Objects & faces** detects common objects and face locations, then traces foreground silhouettes. ALGO/ART territories rank the subjects and choose areas for partial cuts.
- **Keep whole subjects** retains the entire detected silhouette. Turn it off to cut larger portions of an object. Partial windows expand around intersecting detected faces.
- **Source coverage** controls how much material is kept in partial cuts and large image fragments. Default fallback windows retain about 72% of each source's area.
- Images keep their original proportions during cutting. They are no longer cropped to the collage canvas first.
- If recognition finds no usable subject, **large image fragments** keep the composition working. Choose this method directly for landscapes, textures and photographic blocks.
- In **Cut map**, select a pool image and use **Pick a subject**, then click or tap inside a missed object. Dashed lines show ALGO/ART regions; retained subjects appear against a faded source image.
- **Original geometric cuts** remains available. Version 1 project files reopen with that cutter so their compositions retain their original settings.

Recognition runs in a worker on your device using **MediaPipe Tasks Vision 1.1.0**, EfficientDet-Lite0, BlazeFace and MagicTouch V2. Faces are located, not identified. Source pictures are not uploaded to a recognition service. The first recognition request downloads roughly 50 MB of runtime and models from the studio's own origin; later requests reuse the worker and browser cache. Analysis and silhouettes are stored with the images and portable projects. Recompose does not rerun recognition.

This is an experimental cutter: illustrations, tiny faces, overlapping objects, fine hair and backgrounds can confuse the models. A detected box alone is not presented as an extracted object; only a usable foreground mask becomes a subject cut. Picking a subject can help, and large fragments remain available if model loading or inference fails.

## Image pool and composition

- Search **Wikimedia Commons** or **Openverse**, choose a topic, or upload raster images.
- Keep up to **24 images** from multiple searches. Exclude images without removing them.
- Choose **Constructed Forms**, **Recursive Divisions** or **Orbital Studies** independently for selection and assembly.
- **Re-cut** changes the selection regions and partial windows; whole subjects stay intact. **Recompose** changes the layout while retaining the selected fragments. **Shuffle images** changes source assignment.
- Adjust maximum pieces, region detail, quiet space, piece scale, rotation, paper, shadows and monochrome.
- Export a **2× PNG** with embedded UTF-8 source credits, or download readable credits separately.
- Save/open a **portable JSON project** containing the pool, subject masks, seeds and settings. IndexedDB also keeps the pool in this browser.

Different layout families generate different numbers of positions; **Maximum pieces** caps that number. New sessions use fewer, larger pieces. Existing saved composition controls are retained.

## Run and deploy

Node.js 22 or later, Python 3, no API keys or backend:

```sh
git clone https://github.com/southernadd-cmyk/algoCollage.git
cd algoCollage
npm ci
npm test
npm run build
npm run serve
```

Open **http://localhost:8000/**. On Windows, use `py -m http.server 8000 --directory _site` if needed. Serve over HTTP rather than opening a local HTML file. Building downloads the three official models and checks their pinned SHA-256 hashes; cached files are reused. Generated `_site`, model cache and npm dependencies are not committed.

GitHub Pages uses **Settings → Pages → Source → GitHub Actions**. The workflow installs the pinned dependency, tests the engine, builds the static application with its recognition assets, and publishes whenever `main` changes. All paths are relative for the repository subpath.

## Images and licences

The default filter keeps sources identified as **public domain or CC0**. An optional filter also accepts **CC BY / CC BY-SA**, retains source and licence links, and includes them in credits. Unknown, noncommercial and no-derivatives labels are excluded. These metadata filters do not independently verify the original rights.

Search APIs and image hosts are separate. A host may block downloads even when its result appears. Only successfully downloaded raster blobs enter the pool, keeping PNG export safe from cross-origin canvas restrictions. Choose another image or upload a saved copy if a host fails. API downtime does not discard the pool. Commons was verified live; Openverse could not be reached from the validation browser and its live integration remains unverified.

Inputs are limited to **16 MB** and resized to **1600 px** on the longest side; projects are limited to **64 MB**. Exports are 2000 × 2800 portrait, 2800 × 2000 landscape or 2400 × 2400 square. Save a project before clearing browser data.

API references: [MediaWiki search](https://www.mediawiki.org/wiki/API:Search), [image information](https://www.mediawiki.org/wiki/API:Imageinfo), [cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests), [Commons reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia), [Openverse API](https://api.openverse.org/v1/). Recognition references and notices are in [THIRD_PARTY.md](THIRD_PARTY.md).

## Pipeline and checks

`composition.js` runs the unchanged ALGO/ART V7 engine. `image-cuts.js` maps its regions to each full source image, ranks subjects and defines large or partial windows. `subject-worker.js` performs local detection and point-guided segmentation; `subject-data.js` validates and compresses the masks. `render.js` applies silhouettes and assembles the fragments. `storage.js` persists the pool and validates projects before replacing work; `png.js` embeds source credits.

The five engine files in `vendor/algoart/` are **unchanged**, pinned to renderer **V7**, commit [`d231259`](https://github.com/southernadd-cmyk/algoart/commit/d231259ad08a690c1109a6af7f624c769c50eadc). `upstream.json` records their blob hashes. The marker font comes from the same author's project.

`npm test` checks all engine families and formats, separate seed effects, excluded images, licence filters, PNG credits, silhouette round trips and corruption rejection, foreground selection, enlarged regions, subject ranking, whole/partial cuts, face protection and backward-compatible projects. Browser validation is recorded in [DEVELOPMENT.md](DEVELOPMENT.md).
