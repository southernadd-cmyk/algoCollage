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
