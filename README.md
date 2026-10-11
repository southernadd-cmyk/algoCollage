## Cutting method clarity and strict stage separation — 0.6

**Cutting controls live exclusively in the Cutting Room modal.** The material sidebar contains only search, upload and a shortcut to the cutting workspace. Board-specific settings (layout seed, baseline family, maximum pieces, quiet space, rotation, piece scale, canvas, paper, shadows and monochrome) now appear below the **Assembly Board**, beside the actual composition. The board's tabs only switch between Collage and Layout map; returning to the Cutting Room is a separate navigation action, not a third board view.

A recognised subject is no longer silently recycled by every cutting option. **Recognised objects & faces** in *whole subject* mode retains the detected true outline, so it deliberately disables geometry controls which cannot modify it. Unticking *Keep whole subjects* creates three smaller, different ALGO/ART-influenced detail windows clipped to the same recognised silhouette. **Photographic fragments** ignore subject detection and extract multiple smaller, source-space image regions. **Geometric shapes** ignore recognition and cut with the original ALGO/ART closed polygons. Each mode has an explanatory live description and its own candidate previews.

Changing a cutting option regenerates the proposed cutouts and removes any **stale, untransferred** candidates left in the Cutting Room tray. It never silently re-cuts pieces that have already reached the Assembly Board. The tray also has a dedicated Clear selection control. That distinction is explicit because the source material and the artwork belong to different stages.

The regression suite asserts that the main board has no cutting controls, that Mona Lisa's detected head becomes a whole silhouette versus three different details versus larger photo fragments (without subject alpha), and that method-specific controls become enabled/disabled appropriately. The live Chrome smoke test checks actual Mona Lisa image changes across all modes and records separate screenshots.

## Cut → Transfer → Assemble — 0.5

Each layer now has its own **Cutting Room** (open from the workbench, left-hand controls, or a layer's **Edit cuts** button). Select a source photograph, inspect its actual AI/ALGO/ART outlines, use **Pick a subject** to rescue a missed form, and click individual cutout thumbnails to add or remove them from a tray. The cutting engine's settings, re-cut button, and region detail have moved into this full-screen working space. **Nothing moves to the collage board until you click Transfer selected scraps to board.**

The **Assembly Board** is a separate stage: the transferred cutouts are placed **once each**, with no automatic repeating of images to fill spare composition-guide positions. New baseline rearranges the transferred material without re-cutting it; Shuffle scraps rearranges which cutout occupies each slot. A guide needs enough slots to place every selected scrap; the transfer action samples a roomier ALGO/ART guide if necessary. The current selection can be revisited and replaced in its own Cutting Room.

**Lock layer + another** freezes those selected cuts and placements, adds the result to the collage, and opens an **empty Cutting Room** for the next layer. Locked layers expose a read-only **View cuts** record plus their own placement map. The project file is now **v4**, saving the active cutout tray alongside the images and locked layers. v1–v3 projects still open; their pre-existing automatically generated active composition is migrated into a cutout tray on first opening. IndexedDB preserves the current cutouts between sessions.

The earlier browser-wide auto-fill path still exists internally for compatibility, but the new creative workflow uses only explicitly transferred fragments.

# ALGO/COLLAGE

**Collect. Cut. Compose.**

A browser collage studio built on [ALGO/ART](https://github.com/southernadd-cmyk/algoart). Collect free images or upload your own. One seeded ALGO/ART output selects regions and subjects; another output assembles the pieces.

**[Open the live studio →](https://southernadd-cmyk.github.io/algoCollage/)**

![Algo Collage studio before the cut-paper redesign](docs/studio.jpg)

*The original launch screenshot predates the redesigned physical collage workbench.*

## A cut-and-paste workbench — 0.4

The interface is designed to feel like a **collage in progress**, rather than a conventional image-processing dashboard. A dark cutting desk frames a taped paper canvas. Material search lives on a torn notebook leaf; downloaded and uploaded images look like annotated scraps in a drawer. New baseline, locking, shuffling, map views and PNG export are directly beside the composition, with the independent layer pile at the right.

The art direction deliberately combines newsprint and photocopy grain, untrimmed paper edges, small offset print/shadows, masking tape, typewritten specimen labels, the existing ALGO/ART marker typeface and restrained colour from faded inks. Interactive controls retain strong contrast, clearly labelled states, keyboard focus, and 390px mobile layouts. A jump-to-workbench link avoids lengthy scrolling past source controls on phones.

The visuals use local CSS and an extremely small SVG noise tile; there are **no new third-party web assets, font services or image dependencies**. The unchanged collage and export engines still supply the actual artwork; paper effects are UI only and do not alter downloaded PNGs.

## Subject-aware cutting — 0.3

- **Objects & faces** detects common objects and faces. Faces take priority over broad person detections and use small, Sobel edge-guided contours. Other objects use detector-bounded foreground segmentation; oversized results are discarded. ALGO/ART territories rank the resulting silhouettes by actual foreground occupancy, and partial cuts target visible foreground rather than empty bounding-box space.
- **Keep whole subjects** retains the *bounded* traced silhouette, not a whole painting. Turn it off to crop part of a subject. Partial windows expand around intersecting faces.
- **Source coverage** controls partial cuts and explicit large-fragment mode. In Objects & faces, unrecognised images now produce **bounded details of about 21% of the source area** by default; the separate Large image fragments mode still retains about 72%.
- Images keep their original proportions during cutting. They are no longer cropped to the collage canvas first.
- If both recognition models miss an artwork, an edge-density pass tries to select a small focal detail (not a claimed object or face). If that also fails, small ALGO/ART-guided details keep the collage running. Choose **Large image fragments** directly when you want broad landscapes, textures or photographic blocks.
- In **Cut map**, select a pool image and use **Pick a subject**, then click or tap inside a missed object. Dashed lines show ALGO/ART regions; retained subjects appear against a faded source image.
- **Original geometric cuts** remains available. Version 1 project files reopen with that cutter so their compositions retain their original settings.

Recognition runs in a worker on your device using **MediaPipe Tasks Vision 1.1.0**, EfficientDet-Lite0, BlazeFace, MagicTouch V2 for non-face objects and a JavaScript Sobel edge pass. MagicTouch loads only when object segmentation is needed. Faces are located, not identified. Source pictures are not uploaded to a recognition service. The first recognition request downloads roughly 50 MB of runtime and models from the studio's own origin; later requests reuse the worker and browser cache. Analysis and silhouettes are stored with the images and portable projects. Recompose does not rerun recognition.

This remains an experimental cutter: painted faces, tiny objects, fine hair and overlapping subjects can defeat recognition, and Sobel contours are approximate rather than semantic segmentation. A broad person detection cannot by itself yield the whole portrait. Old oversized cached masks are invalidated and recalculated when reopening a pool or v2 project. Use **Pick a subject** for missed faces, or switch to Large image fragments for intentionally wide crops.

## Random composition baselines and locked layers — 0.3

**New baseline** replaces the assembly layout dropdown. Every click samples nine fresh, seeded guides across the three ALGO/ART families (orbital, constructed and recursive), scoring the spacing, overall canvas coverage and balance of their positions. It picks a widely distributed candidate; this is deliberately not a guarantee that objects will never overlap. The chosen family and reproducible seed remain visible.

**Lock layer & add another** freezes the active layer's actual artwork: assigned image IDs, cut shapes and subject masks, placement geometry, visual settings and its own composition guide. A fresh independently seeded active layer appears above it. Locked pieces remain visible beneath subsequent layers in the main collage, and the layer stack provides **View guide** for each snapshot or the editable active layer. Remove a locked layer without changing the other snapshots.

The full stack, source credits and each locked guide are preserved in the downloaded PNG and portable **v3** project, and the stack is also kept with the image pool in IndexedDB. Old v1 and v2 projects still open with no locked layers. A source image used by a locked layer cannot be deleted until that layer is removed; the canvas orientation is fixed while layers exist. Paper is a canvas-wide setting. There is a practical limit of 12 locked layers (plus the editable active one).

## Image pool and composition

- Search **Wikimedia Commons** or **Openverse**, choose a topic, or upload raster images.
- Keep up to **24 images** from multiple searches. Exclude images without removing them.
- Choose **Constructed Forms**, **Recursive Divisions** or **Orbital Studies** for cutting regions. Generate fresh assembly baselines with **New baseline**; the studio automatically evaluates the three families for spacing.
- **Re-cut** changes the selection regions and partial windows; whole subjects stay intact. **Recompose** changes the layout while retaining the selected fragments. **Shuffle images** changes source assignment.
- Adjust maximum pieces, region detail, quiet space, piece scale, rotation, paper, shadows and monochrome.
- Export a **2× PNG** with embedded UTF-8 source credits, or download readable credits separately.
- Save/open a **portable JSON project** containing the pool, subject masks, seeds, settings and every locked layer's geometry and layout map. IndexedDB also keeps the pool and layers in this browser.

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

`composition.js` runs the unchanged ALGO/ART V7 engine. `layer-stack.js` scores new baseline candidates and freezes independent composition layers. `image-cuts.js` maps its regions to each full source image, ranks subjects and defines large or partial windows. `subject-worker.js` performs local detection and bounded segmentation; `edge-trace.js` supplies Sobel-guided contours and painterly saliency details; `subject-data.js` validates and compresses the masks. `render.js` applies silhouettes and assembles the fragments. `storage.js` persists the pool and validates projects before replacing work; `png.js` embeds source credits.

The five engine files in `vendor/algoart/` are **unchanged**, pinned to renderer **V7**, commit [`d231259`](https://github.com/southernadd-cmyk/algoart/commit/d231259ad08a690c1109a6af7f624c769c50eadc). `upstream.json` records their blob hashes. The marker font comes from the same author's project.

`npm test` checks all engine families and formats, separate seed effects, excluded images, licence filters, PNG credits, silhouette round trips and corruption rejection, foreground selection, subject ranking, whole/partial cuts, face protection, portrait-sized contour limits and backward-compatible projects. Browser validation is recorded in [DEVELOPMENT.md](DEVELOPMENT.md).
