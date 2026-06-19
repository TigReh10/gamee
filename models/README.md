# Character models

Drop the character files in this folder. **Use Git, not GitHub's drag-and-drop web uploader** — these files are over GitHub's 25 MB web-upload limit.

Expected filenames:

- `joel.fbx`  — Joel
- `ellie.fbx` — Ellie

## How to add them from your Codespace

1. Drag the two `.fbx` files into this `models/` folder in the VS Code (Codespace) file explorer.
2. Commit & push:
   ```bash
   git add models/joel.fbx models/ellie.fbx
   git commit -m "Add Joel and Ellie character models"
   git push
   ```

The game loads these with Three.js `FBXLoader`. They are Mixamo exports that contain a single **"Double Dagger Stab"** animation clip, which the game plays as the melee / attack move.

> **Tip:** these `.fbx` files are large (Joel ~28 MB, Ellie ~69 MB), so the game will take a while to load them. Converting to compressed `.glb` makes it load *much* faster — e.g. in your Codespace run `npx --yes fbx2gltf -b -i models/joel.fbx -o models/joel.glb` (and the same for ellie). If you do that, tell me and I'll point the loader at the `.glb` files.
