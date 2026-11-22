# Lanes

An open-source multi-lane AI workspace with an embedded **Ghostty** WebAssembly terminal, WebGL2 terminal shaders, **Paper Shaders**, and **React Bits**-inspired interactive live backgrounds.

## Highlights

- **Multi-lane workspace & parallel workers:** Keep projects separated in lanes, spin up branch workers with inline approvals/decisions, and keep private lanes isolated with per-lane draft storage.
- **Embedded Ghostty terminal (`ghostty-web`):** Real VT100 Ghostty parser running in WebAssembly, connected over WebSocket to a live local shell (`zsh` / `bash`) via a lightweight zero-native-build PTY bridge (`bin/pty-bridge.py`).
  - Available in both the **Worker side panel** (`Terminal` tab) and a **collapsible, resizable lane bottom drawer** (`Ctrl + \``).
  - **Ghostty Terminal Studio (`#/studio/terminal`):** 13 curated terminal themes, live color & ANSI palette pickers, font/padding/cursor controls, 8 built-in WebGL2 shaders (`Bloom`, `Better CRT`, `Retro CRT`, `VHS`, `RGB Split`, `Starfield`, `Matrix`, `Cursor Warp`), automatic discovery of `~/.config/ghostty/shaders/*.glsl`, and 1-click Ghostty config import/export (compatible with [ghostty.style](https://ghostty-style.vercel.app/)).
- **16 themes & 26 live WebGL backgrounds (`#/studio/appearance`):**
  - 8 paired light/dark OKLCH theme families (`Calm`, `Warm Paper`, `Midcentury Modern`, `Midnight`, `High Contrast`, `Windows XP`, `Windows 98`, `Terminal`).
  - **12 Paper Shaders** (`@paper-design/shaders-react`): Mesh Gradient, Grain Gradient, Neuro Noise, Warp, Smoke Ring, God Rays, Dithering, Voronoi, Swirl, Metaballs, Dot Orbit, Color Panels.
  - **8 React Bits interactive backgrounds:** Silk, Iridescence, Liquid Chrome, Prism, Beams, Line Waves, Plasma, Grid Distortion.
  - **6 Lanes originals:** Starfield, Nebula, Caustics, Lava Lamp, Aurora, Ripples.
  - Live backgrounds render strictly behind chrome, cards, inputs, and readable text — visible only in empty window space — and automatically pause when reduced motion is enabled or the tab is hidden.
- **3D Studio & Media / Voice:** Three.js spatial workspace map and optional Gemini chat, image, video, music, live voice, and audio transcription routes.

## Quick Start

Requires **Node.js 22+** and **Python 3** (for the local PTY terminal bridge on macOS/Linux).

```bash
git clone https://github.com/chadmarkey/lanes.git
cd lanes
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or pass a custom port, e.g. `PORT=3010 npm run dev`).

### Optional: Gemini API key

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` if you want live Gemini chat, media generation, and voice transcription:

```bash
cp .env.example .env
```

Without a key, the entire workspace, Ghostty terminal, themes, and shader studios work locally out of the box.

## Scripts

```bash
npm run dev    # Start Express + Vite dev server with live WebSocket terminal
npm run build  # Build production client bundle to dist/
npm start      # Serve production build
npm run lint   # TypeScript typecheck
npm test       # Run unit and server tests
```

## Open-Source Credits

- [ghostty-web](https://github.com/coder/ghostty-web) (MIT) — Ghostty VT100 parser compiled to WebAssembly
- [@paper-design/shaders-react](https://shaders.paper.design) (Apache-2.0) — Paper Shaders WebGL backgrounds
- [Lucide](https://lucide.dev) (ISC), [React](https://react.dev) (MIT), [Tailwind CSS](https://tailwindcss.com) (MIT), [Three.js](https://threejs.org) (MIT)

## License

[MIT](./LICENSE) © 2026 Chad Markey
