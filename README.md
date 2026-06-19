# The Last of Us — Part II  🌿🔦  *(3D)*

A **first-person 3D stealth-survival game** that runs in the browser, inspired by the mood and mechanics of *The Last of Us Part II* — a fallen, overgrown Seattle crawling with the Infected. Built with **Three.js** (WebGL).

> **Unofficial fan tribute.** Non-commercial homage. All code and 3D geometry are original — built and lit at runtime. No copyrighted assets (art, audio, screenshots, story, or characters) are used. *The Last of Us* is a trademark of Sony Interactive Entertainment / Naughty Dog; this project is not affiliated with or endorsed by them.

## ▶️ Play

Single static page — no build step. **Three.js loads from a CDN, so you need an internet connection** the first time.

- **Recommended:** Enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root), then open the published URL.
- **Local:** serve the folder (so the CDN script works) and open in a browser:
  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```
- Click **“Click to Start”** — the game uses **pointer lock** for mouse-look, so click the screen to capture the mouse. Press **Esc** to release / pause.

## 🎮 Controls

| Action | Input |
| --- | --- |
| Look around | Mouse |
| Move | `W A S D` / Arrow keys |
| Crouch (quiet, lower profile) | Hold `Shift` |
| Fire pistol (loud — draws everything!) | Left-click |
| Throw bottle (distraction) | Right-click |
| Melee | `Space` |
| Stealth takedown (crouch / from behind) | `E` |
| Use health kit | `R` |
| Toggle flashlight | `F` |
| Pause | `Esc` |

## 🧟 The Infected

- **Runners** — hunt by **sight** (vision range + field of view + line of sight). They chase when they spot you and investigate noises.
- **Clickers** — **blind**, they hunt purely by **sound**. One touch is lethal — but you can slip a silent takedown while crouched.

## 🎯 Objective

Scavenge the **surgical supplies** hidden in the ruins, then reach the glowing **green extraction pad**. Bullets are scarce — stealth, distraction, and patience keep you alive.

## 🛠️ Tech

- **Three.js / WebGL** first-person renderer with real 3D geometry, dynamic **flashlight spotlight + shadows**, fog, ambient/hemisphere lighting, and procedurally generated levels.
- Noise-propagation AI (patrol → investigate → chase), raycast shooting, physics-y thrown bottles, synthesized Web Audio SFX, and HTML HUD overlay.

## 📁 Structure

```
index.html   # page shell, HUD, styles, loads Three.js (CDN) + game.js
game.js      # full 3D engine (level gen, rendering, AI, input, audio)
```

*Made as a learning/portfolio project and a love letter to the game's tense stealth gameplay.*
