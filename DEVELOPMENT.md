# Prototype validation

The prototype reuses the author's current ALGO/ART V7 engine without changing its source. Both geometry stages come from that engine; the collage renderer is a separate adapter.

## Automated checks

`npm test` covers deterministic cut/assembly geometry in every available family and orientation, independent seeds, excluded sources, provider response parsing, licence filtering, project validation, pinned source integrity and PNG source-credit encoding.

Additional local validation used a real Canvas 2D raster implementation and three synthetic source images. All **27 combinations** of cut family × assembly family × canvas format rendered nonempty collages, and both guide views rendered successfully. The exported credited PNG decoded as **2000 × 2800**. These synthetic fixtures establish the rendering path, not external photo retrieval.

The HTML has unique IDs and valid label targets, all linked assets exist, and the HTTP entry point, application module, vendored engine and marker font served successfully.

## Browser checks

All seven Node.js test groups and all JavaScript syntax checks pass. The geometry tests exercise the actual pinned engine in a recording context, not a substitute layout implementation.

Full browser validation is **not yet completed**: the local runtime has Playwright but no installed browser binary, and the available remote Chrome cannot reach the local preview server (`ERR_CONNECTION_REFUSED`). UI interactions, file-picker behaviour and IndexedDB persistence remain to be verified in a real browser. No screenshot or live deployment is claimed as proof of those behaviours.

## Live API limitation

The development environment blocks network access to `commons.wikimedia.org` and `api.openverse.org` (HTTP 403). Provider interfaces are based on their official documentation. Controlled API responses can validate search, pool addition, download failure handling and export, but do not establish that the live providers or individual image hosts work from the deployed site.

Before treating live image search as verified, check from a normal browser: search each provider, add a result, export a PNG and reopen the saved project. Uploads provide an independent way to exercise the whole image-cutting pipeline.
