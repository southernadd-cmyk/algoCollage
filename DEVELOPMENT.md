# Launch validation

The prototype reuses the author's current ALGO/ART V7 engine without changing its source. Both geometry stages come from that engine; the collage renderer is a separate adapter.

## Automated checks

`npm test` covers deterministic cut/assembly geometry in every available family and orientation, independent seeds, excluded sources, provider response parsing, licence filtering, project validation, pinned source integrity and PNG source-credit encoding.

Additional local validation used a real Canvas 2D raster implementation and three synthetic source images. All **27 combinations** of cut family × assembly family × canvas format rendered nonempty collages, and both guide views rendered successfully. The exported credited PNG decoded as **2000 × 2800**. These synthetic fixtures establish the rendering path, not external photo retrieval.

The HTML has unique IDs and valid label targets, all linked assets exist, and the HTTP entry point, application module, vendored engine and marker font served successfully.

## Public deployment

The application is live at **https://southernadd-cmyk.github.io/algoCollage/**. GitHub Pages uses the GitHub Actions publishing source. The workflow runs the engine tests and JavaScript syntax checks before uploading only the application's static assets and deploying them. The initial deployment [completed successfully](https://github.com/southernadd-cmyk/algoCollage/actions/runs/38096799830).

## Live browser checks

The deployed application was exercised in Chrome. Commons topic searches returned 9 botanical results and 15 space results with the default public-domain/CC0 filter. Five real images from these two searches were downloaded into the same pool and rendered together. A PNG upload also entered the pool successfully and was removed after checking it.

- Recompose changes only the layout seed; Re-cut changes only the cut seed.
- Unchecking a source reduced the active image count while retaining the image in the pool; Use all restored it.
- Cut map and layout map rendered, including keyboard navigation between view tabs.
- The portrait collage rendered with 18 fragments; switching cut family, assembly family and square format produced a 1200 × 1200 collage with 14 fragments.
- Reloading the page retained the ordered image pool and changed seed settings.
- A saved JSON project contained the three original images, then reopened through the file chooser and restored its exact cut and layout seeds.
- The browser's exported PNG was downloaded and inspected: **2000 × 2800**, valid PNG chunk CRCs, and an embedded UTF-8 source-credit chunk containing the source titles and links.

The [launch screenshot](docs/studio.jpg) shows the live square composition and its five-image pool. Source pictures shown there are the public-domain/CC0 Commons results described above. Desktop Chrome was checked; separate mobile and other-browser validation remains outstanding.

## Provider limitation

Live Commons search, raster downloads, rendering and export work from the deployed site. **Openverse could not be reached** from the validation browser; the application displayed its source-unavailable message without losing the pool. Its endpoint and parsing are covered against controlled responses and official API documentation, but its live search and image downloads remain unverified. Commons is the default provider, and uploads offer another working source of material.

## Subject cutter 0.2

The unchanged ALGO/ART guide geometry now supplies image-space selection regions. MediaPipe object and face detection proposes points; MagicTouch V2 supplies foreground masks. Masks are compressed and retained with the pool, so changing assembly does not repeat inference. Unrecognised or unavailable subjects use larger source-space fragments. A per-image inspector supports manual point selection.

The 13 automated checks pass, including mask corruption rejection, connected foreground selection, large fragment coverage, guide-based subject ranking, whole silhouettes, partial cuts around faces, and v1/v2 project compatibility. All application JavaScript parses and the HTML IDs, label targets and linked assets validate. The local static build verifies all three downloaded model hashes.

The subject-geometry follow-up compares the actual ALGO/ART territory polygons with a cached 64 × 64 occupancy map of each segmented mask. In partial mode, regions that fall in a silhouette hole instead target the nearest visible foreground. This improves source selection without editing the upstream ALGO/ART generator. Unit tests cover misleading bounding boxes and a concave L-shaped silhouette.

The automated suite does not prove that MediaPipe inference finishes in a real desktop or mobile browser. A post-deployment browser check with actual source photographs, manual picking, persistence, recomposition and PNG export is still required; no end-to-end subject-recognition claim is made here.


## Conservative face and edge cutter — 0.3

The 0.2 subject pass exposed two regressions with paintings: a broad person detection could suppress the face candidate, and a failed extraction silently fell back to a crop covering most of the source. As a result, a Mona Lisa input could yield nearly the whole painting instead of a head.

The new path uses face-first proposals, small Sobel edge-guided head contours, detector-bounded MagicTouch segmentation for other objects, a stringent maximum-area gate on stored masks and compact saliency-selected details when recognition fails. The separate broad-region setting remains unchanged. The default Objects & faces fallback now uses roughly 21% of the source area, not roughly 72%. Legacy analysis results are invalidated for recomputation but existing v2 project files are still importable. MagicTouch is lazily initialised to avoid its memory cost for face-only images.

Synthetic Node tests verify that broad person detections cannot suppress small faces, full-painting confidence masks are rejected, contour masks remain local, painterly edges produce bounded details and legacy mask caches refresh. The live smoke script additionally attempts a public-domain Mona Lisa fixture and logs candidate bounds. A passing test of area limits **does not prove** that the selected contour follows painted facial features correctly; a human visual check of the live Cut map is still necessary. If Mona Lisa image retrieval is blocked by Wikimedia, the smoke report explicitly records the omission rather than claiming a portrait test passed.


## Random baselines and frozen layer stack — 0.3

The baseline UI no longer exposes an assembly-layout dropdown: **New baseline** draws nine seeded ALGO/ART candidates across all three engine families, scoring spatial distribution, coverage, clustering and quadrant balance. The chosen family and seed remain visible for repeatability. A snapshot made by **Lock layer & add another** captures each piece's image reference, actual cut mask, position, styling and a separate snapshot of the layout map. Later recuts and new baselines only affect the active layer. Snapshots composite bottom-up in the PNG and carry their own guide information into source credits.

Up to 12 locked layers are retained in IndexedDB alongside the source pool; export/import uses v3 portable projects, with v1/v2 compatible. While there are locked layers, orientation changes are unavailable and image removal is guarded if a locked piece still references that source. Removed locked layers do not alter other snapshots.

Unit tests validate dispersion ranking, deterministic candidate selection, two independent layout guides, frozen piece geometry, snapshot removal and malicious/incompatible project rejection. The live browser smoke test was extended to lock two layers, inspect their maps and verify a v3 save/reopen. These checks prove the workflow functions; they do not certify an artistic judgement that the chosen guide is always the most attractive.

## Cut → Transfer → Assemble — 0.5

Each layer now has its own **Cutting Room** (open from the workbench, left-hand controls, or a layer's **Edit cuts** button). Select a source photograph, inspect its actual AI/ALGO/ART outlines, use **Pick a subject** to rescue a missed form, and click individual cutout thumbnails to add or remove them from a tray. The cutting engine's settings, re-cut button, and region detail have moved into this full-screen working space. **Nothing moves to the collage board until you click Transfer selected scraps to board.**

The **Assembly Board** is a separate stage: the transferred cutouts are placed **once each**, with no automatic repeating of images to fill spare composition-guide positions. New baseline rearranges the transferred material without re-cutting it; Shuffle scraps rearranges which cutout occupies each slot. A guide needs enough slots to place every selected scrap; the transfer action samples a roomier ALGO/ART guide if necessary. The current selection can be revisited and replaced in its own Cutting Room.

**Lock layer + another** freezes those selected cuts and placements, adds the result to the collage, and opens an **empty Cutting Room** for the next layer. Locked layers expose a read-only **View cuts** record plus their own placement map. The project file is now **v4**, saving the active cutout tray alongside the images and locked layers. v1–v3 projects still open; their pre-existing automatically generated active composition is migrated into a cutout tray on first opening. IndexedDB preserves the current cutouts between sessions.

The earlier browser-wide auto-fill path still exists internally for compatibility, but the new creative workflow uses only explicitly transferred fragments.


## Cutting method clarity and strict stage separation — 0.6

**Cutting controls live exclusively in the Cutting Room modal.** The material sidebar contains only search, upload and a shortcut to the cutting workspace. Board-specific settings (layout seed, baseline family, maximum pieces, quiet space, rotation, piece scale, canvas, paper, shadows and monochrome) now appear below the **Assembly Board**, beside the actual composition. The board's tabs only switch between Collage and Layout map; returning to the Cutting Room is a separate navigation action, not a third board view.

A recognised subject is no longer silently recycled by every cutting option. **Recognised objects & faces** in *whole subject* mode retains the detected true outline, so it deliberately disables geometry controls which cannot modify it. Unticking *Keep whole subjects* creates three smaller, different ALGO/ART-influenced detail windows clipped to the same recognised silhouette. **Photographic fragments** ignore subject detection and extract multiple smaller, source-space image regions. **Geometric shapes** ignore recognition and cut with the original ALGO/ART closed polygons. Each mode has an explanatory live description and its own candidate previews.

Changing a cutting option regenerates the proposed cutouts and removes any **stale, untransferred** candidates left in the Cutting Room tray. It never silently re-cuts pieces that have already reached the Assembly Board. The tray also has a dedicated Clear selection control. That distinction is explicit because the source material and the artwork belong to different stages.

The regression suite asserts that the main board has no cutting controls, that Mona Lisa's detected head becomes a whole silhouette versus three different details versus larger photo fragments (without subject alpha), and that method-specific controls become enabled/disabled appropriately. The live Chrome smoke test checks actual Mona Lisa image changes across all modes and records separate screenshots.
