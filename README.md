# Figure Pose Recorder (`figure-pose-app`)

A small Vite + React + TypeScript web app that records full-body motion from a
webcam using **MediaPipe Pose**, then exports that motion as a compact
**clip JSON** that the React Native **`StickFigure`** player can replay.

The recorder itself is the web front-end; the rest of the repo (the Expo app)
is the consumer. The recorder is intentionally offline-capable and writes its
output directly into the RN app's asset tree.

---

## 1. What it does

1. Opens a webcam feed and runs MediaPipe Pose (33 landmarks) at ~30 fps.
2. Renders a live skeleton overlay so you can see what is being tracked.
3. Records the pose stream as a sequence of keyframes.
4. Converts those 33 raw MediaPipe landmarks into a **15-joint, front-facing
   skeleton** with one global bounding box (so real translation — stepping,
   jumping, swaying — is preserved, not normalized away).
5. Saves the result as a **clip JSON** straight into
   `../components/stick-figure/clips/<name>.json`, ready to be played by
   `components/stick-figure`.

---

## 2. Prerequisites

- Node.js 18+ (matches the workspace toolchain).
- A camera and a browser that allows webcam access.
- **HTTPS or `localhost`** — `getUserMedia` requires a secure context. The dev
  server already runs over HTTPS via `@vitejs/plugin-basic-ssl`.

---

## 3. Install & run

```bash
cd figure-pose-app
npm install
npm run dev
```

- Dev server: `https://localhost:5173` (also exposed on the LAN via `host: true`).
- `npm run build` — type-check (`tsc`) then produce a static build in `dist/`.
- `npm run preview` — serve the built bundle (no `/save-clip` endpoint here).

> The dev server uses a **self-signed certificate**. Your browser will warn
> about it — choose "Advanced → Proceed" the first time. Camera access won't
> work if you skip this.

---

## 4. Recording workflow

1. Open `https://localhost:5173` and allow camera permission.
2. Pick a camera from the **Camera** dropdown (front camera is mirrored; back /
   rear cameras are detected by label and not mirrored).
3. Click **Start Camera** — MediaPipe Pose tracking begins and the skeleton
   overlay appears.
4. Click **⏺ Record Movement**, perform the movement, then click
   **⏹ Stop Recording**.
5. Give the movement a name (e.g. `jumping jacks`).
6. Click **↓ Save to workspace**.

**Save behavior:**

- In `npm run dev`, the app `POST`s the clip to the `/save-clip` middleware
  (see `vite.config.ts`). It writes the JSON to
  `components/stick-figure/clips/<slug>.json` and shows the written path.
- If the endpoint is unavailable (e.g. `vite preview` or a hosted build), the
  app falls back to a **browser download**, and you drop the JSON into
  `components/stick-figure/clips/` yourself.

---

## 5. Using a clip in React Native

The consumer is `components/stick-figure/index.tsx` (`StickFigure`). It accepts
a clip three ways:

### A. Bundled `require` (most common)

```tsx
import StickFigure from '../../components/stick-figure';
import recordedMovement from '../../components/stick-figure/clips/jacks2.json';

<StickFigure
  source={recordedMovement}
  size={120}
  color="#111"
  stroke={5.5}
/>;
```

The JSON is imported/bundled statically — no network at runtime.

### B. URL string (fetched at runtime)

```tsx
<StickFigure
  source="https://example.com/clips/jacks2.json"
  size={120}
  color="#111"
/>;
```

The clip is fetched, validated with `isValidClip`, and played. While loading
(or on failure) the built-in `walk` clip plays as a fallback.

### C. Already-parsed object

```tsx
import { Clip } from '../../components/stick-figure/schema';

const clip: Clip = { /* ... */ };
<StickFigure clip={clip} />;
```

### Useful `StickFigure` props

| Prop | Meaning |
| --- | --- |
| `source` | `Clip` object, `require()`'d module, or URL string. |
| `clip` | Pre-parsed clip; wins over `source`. |
| `size` | Rendered size in points. |
| `color` | Stroke color. |
| `stroke` | Limb stroke width (viewBox units). |
| `spineStroke` | Spine width (defaults to `stroke`). |
| `shoulderCurve` | Rounds the outer shoulders. |
| `headOffsetY` | Nudges the head circle up/down. |
| `durationMs` | Override loop duration (defaults to `frameCount / fps`). |
| `paused` | Freeze on the first frame. |

Pass `key={clip.id}` at the call site to cleanly restart the loop when
switching clips.

---

## 6. Clip JSON format

Defined in `components/stick-figure/schema.ts` (and produced 1:1 by
`figure-pose-app/src/utils/poseToClip.ts`):

```jsonc
{
  "id": "rec-1786469213788",       // unique id; filename stem for recorded clips
  "name": "jacks2",                // human-readable label
  "source": "recorded",            // 'builtin' | 'recorded'
  "fps": 30,
  "frameCount": 1219,
  "loop": true,
  "viewBox": [0, 0, 100, 100],     // coordinate space; +x right, +y down
  "head": { "r": 6.79 },           // head circle radius, viewBox units
  "headIndex": 0,                  // index into joints[]/frames[] of the head
  "joints": [                      // 15 fixed joints, in this order
    "head", "neck",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "pelvis",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle"
  ],
  "bones": [                       // [jointA, jointB] index pairs
    [0, 1], [1, 8], [2, 3], [9, 10],
    [2, 4], [4, 6], [3, 5], [5, 7],
    [9, 11], [11, 13], [10, 12], [12, 14]
  ],
  "frames": [                      // frames[f][j] = [x, y] of joint j
    [[50, 10], [50, 22], /* ... 13 more ... */],
    /* ... */
  ]
}
```

Key points:

- Coordinates are in the `viewBox` space, normalized to a **100 × 100** box.
- `neck` and `pelvis` are computed midpoints (shoulder / hip midpoints), not raw
  MediaPipe landmarks.
- `poseToClip` fits the **whole recording** into one global bounding box and
  mirrors X so playback matches the mirrored selfie view you recorded against.

---

## 7. Project layout

```
figure-pose-app/
├── index.html                  # Vite entry
├── vite.config.ts              # HTTPS + /save-clip middleware → ../components/stick-figure/clips
├── public/mediapipe/           # MediaPipe Pose runtime + models (offline, same-origin)
└── src/
    ├── main.tsx                # React mount
    ├── App.tsx                 # camera selection, record/save/name UI
    ├── App.css
    ├── components/
    │   ├── CameraView.tsx      # <video> + mirroring
    │   └── SkeletonOverlay.tsx # live SVG skeleton
    ├── hooks/
    │   ├── usePoseDetection.ts # drives MediaPipe Pose from a <video> via rAF
    │   └── useRecording.ts     # 30 fps keyframe capture
    └── utils/
        ├── poseToClip.ts       # 33 landmarks → 15-joint Clip (the important converter)
        ├── exportPose.ts       # JSON download helpers
        └── skeletonMapping.ts  # MediaPipe landmark indices + skeleton def
```

---

## 8. How the pieces connect

```
webcam ──▶ usePoseDetection (MediaPipe Pose, 33 lm/frame)
              │
              ▼
        useRecording (30 fps PoseFrame[] keyframes)
              │
              ▼
        poseToClip (15-joint, mirrored, viewBox-normalized Clip)
              │
        POST /save-clip ──▶ components/stick-figure/clips/<name>.json
              │
              ▼
   StickFigure (Expo/RN)  <── source={require('./clips/<name>.json')}
```

---

## 9. Notes & troubleshooting

- **Camera won't open**: the page must be served over HTTPS or `localhost`.
  Accept the self-signed cert warning first.
- **Works offline**: MediaPipe assets are bundled under `public/mediapipe` and
  served from the same origin (`locateFile: file => 'mediapipe/' + file`), so
  there is no CDN dependency after install.
- **Recording too short**: `poseToClip` returns `null` (and the UI shows
  "Recording too short") if fewer than 2 usable frames were captured.
- **Landmark dropouts**: `poseToClip` holds each joint's last good position when
  visibility drops below `0.3`, so brief occlusions don't make the figure pop.
- **Camera switching mid-run**: `usePoseDetection` pumps frames from whatever
  stream is attached to the `<video>`, so swapping cameras does not restart
  MediaPipe.
- **`/save-clip` only exists in `npm run dev`.** A static build/preview can't
  write into the workspace, so it downloads the JSON instead.
