# The Last of Us — Part II  🌿🔦

An **original, browser-playable stealth-survival game** inspired by the mood and mechanics of *The Last of Us Part II* — a fallen, overgrown Seattle crawling with the Infected.

> **Unofficial fan tribute.** This is a non-commercial homage. All code and artwork are 100% original and drawn at runtime on an HTML5 `<canvas>`. No copyrighted assets (art, audio, screenshots, story, or characters) are used. *The Last of Us* is a trademark of Sony Interactive Entertainment / Naughty Dog; this project is not affiliated with or endorsed by them.

## ▶️ Play

It's a single static page — no build step.

- **Option A:** Open `index.html` directly in a modern browser.
- **Option B (recommended):** Enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root), then visit the published URL.
- **Option C:** Serve locally:
  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

## 🎮 Controls

| Action | Input |
| --- | --- |
| Move | `W A S D` / Arrow keys |
| Crouch (quiet, hide in tall grass) | Hold `Shift` |
| Aim | Mouse |
| Fire pistol (loud — draws everything!) | Left-click |
| Throw bottle (distraction) | Right-click |
| Melee | `Space` |
| Stealth takedown (crouch, from behind) | `E` |
| Use health kit | `R` |
| Toggle flashlight | `F` |
| Pause | `Esc` / `P` |

## 🧟 The Infected

- **Runners** — hunt by **sight**. They have a vision cone (shown on screen) and chase when they spot you. They also react to noise.
- **Clickers** — **blind**, they hunt purely by **sound** (echolocation). One touch is lethal — but you can slip a silent takedown on them while crouched.

## 🎯 Objective

Scavenge the **surgical supplies** hidden in the ruins, then reach the **extraction pad** in the NE corner. Bullets are scarce — stealth, distraction, and the dark are your best weapons.

## 🛠️ Tech

- Pure vanilla JavaScript + HTML5 Canvas. No dependencies.
- Fog-of-war + dynamic flashlight lighting, line-of-sight detection, noise-propagation AI (patrol → investigate → chase), synthesized Web Audio SFX, particles, and screen shake.

## 📁 Structure

```
index.html   # page shell, HUD, styles, overlays
game.js      # full game engine (rendering, AI, input, audio)
```

*Made as a learning/portfolio project and a love letter to the game's tense stealth gameplay.*
