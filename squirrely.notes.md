# Squirrely — Dev Notes

## Overview

Squirrely is a browser-based highway-crossing arcade game built with Three.js.
The player controls a squirrel that must cross a busy road, collect acorns,
avoid smoke-bomb hazards, and fill four tree hollows before time runs out —
all while dodging traffic driven by cars with distinct AI "personalities."

## File Structure

- `index.html` — page shell, HUD markup, overlay/instructions, import map for Three.js
- `styles/main.css` — global page styles, overlay/start screen styling
- `styles/hud.css` — in-game HUD styling (score, timer, lives, hollows, driver legend, cards/hints)
- `src/main.js` — game entry point / module bootstrap (Three.js scene, game loop)

## Navigation

- A **Home** link (`← Home`) is now present at the top-center of the page,
  linking back to the site root (`/`). It sits above the HUD (z-index 30)
  and uses the existing HUD color/background variables for visual consistency.
- The link is always visible, including during gameplay and on the start overlay.

## Controls

- Arrows / WASD: hop between lanes
- Space: dash (advances 2 rows)
- Shift (hold): crouch
- T: taunt
- E: drop carried item (e.g. smoke bomb)
- Esc: pause
- Touch: swipe to hop, tap to taunt, double-tap to dash, long-press to drop,
  two-finger hold to crouch

## Driver Personalities (color-coded)

- Red — hunts the player
- Yellow — panics
- Blue — swerves for the player
- Green — rages in jams
- Purple — doesn't see the player
- White — steady/default behavior

## Gameplay Mechanics

- Player can carry up to 2 acorns in mouth at once.
- Acorns collected on the road must be banked in one of 4 tree hollows to score.
- Smoke bombs cannot be banked — only dropped (E) to create a roadside distraction.
- Motorcycles move faster than cars and can dodge within their lane.
- HUD elements:
  - Top-left: score, multiplier, lives, mouth contents (carried items)
  - Top-right: timer (turns red/pulses when low), level indicator
  - Bottom-center: hollow-fill indicators (4 circles, filled = orange glow)
  - Bottom-right: driver legend chips (active/locked/pulse states)
  - Center-top card: contextual status messages
  - Bottom hint: transient contextual hints

## Styling Notes

- CSS custom properties (`--hud-fg`, `--hud-bg`, `--accent`) drive consistent
  theming across HUD and overlay elements.
- HUD container uses `pointer-events: none` so it never blocks game input;
  individual interactive elements (like the new home link) must explicitly
  opt back into pointer events since they render outside the `#hud` container.

## Follow-up / TODO

- Verify home link target (`/`) resolves correctly relative to deployment
  path if the game is served from a subdirectory.
- Consider adding a confirmation prompt before navigating away mid-game to
  avoid accidental loss of progress.
- No functional/game-logic changes were made in this update — only the
  navigation link addition and documentation.
