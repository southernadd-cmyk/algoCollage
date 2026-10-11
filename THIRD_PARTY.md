# Image analysis

The static build bundles [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe), version 1.1.0, and its CPU WebAssembly runtime. MediaPipe is licensed under [Apache License 2.0](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE). Copyright Google LLC and the MediaPipe contributors.

Models are downloaded from Google's public MediaPipe model distribution and verified against `models/manifest.json`:

- EfficientDet-Lite0, int8: common object detection, COCO labels.
- BlazeFace short range, float16: face locations and landmarks; no identity recognition.
- MagicTouch V2, int8: foreground masks guided by points.

Model and task documentation: [Object detector](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector), [Face detector](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector), [Interactive segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter).

See the upstream model cards and licence notices for the models and their training data. Source-image licences are retained separately in each collage's credits. Detection and segmentation run on the device; they do not send source photographs to a recognition service.
