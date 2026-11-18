# Dusk Rush ’64

[Visit the arcade](https://nearbycoder.github.io/dusk-rush-64/) or [play directly](https://nearbycoder.github.io/dusk-rush-64/play/).

For offline play, open **docs/play/index.html** in a WebGL2-capable browser. The game runs offline with no installation, build step, libraries, fonts or asset downloads.

Choose a mode, select a course and vehicle, then launch the race. All 20 courses, 30 vehicles and eight paint colours are available immediately. Championship saves after each round. Time Attack records a local ghost when you set a course best. Settings, times and championship progress use browser-local storage.

| Control                | Action                                 |
| ---------------------- | -------------------------------------- |
| W / ↑                  | Accelerate                             |
| S / ↓                  | Brake, then reverse                    |
| A / D or ← / →         | Steer and balance in the air           |
| Shift                  | Boost                                  |
| Space                  | Handbrake                              |
| C                      | Cycle chase, bumper and bonnet cameras |
| R                      | Recover to a safe road position        |
| Escape                 | Pause or go back                       |
| Arrows / Tab and Enter | Navigate menus                         |

Drag the car in the showroom or press Q and E to rotate it.

A standard gamepad uses its left stick to steer, triggers to accelerate and brake, left shoulder for boost, and the west face button for the handbrake. The north face button changes camera, Select recovers, and Start pauses. Touch devices display simultaneous on-screen controls. Sound is off initially and can be enabled in the header or Settings.

## Verification

Run `node tests/verify.mjs` with Node 22+ and Chrome installed. Set `CHROME` to the browser executable if it is outside the detected locations. The test launches a temporary headless browser profile, exercises the fixed-timestep simulation and writes PNG screenshots to `captures/`. Each numbered car and track capture follows the order in the selectors. The suite also reads the uploaded WebGL triangles and checks the camera near plane and moving car bodies against the rendered courses. It runs all 20 tracks at each difficulty and completes all five cups.

The revised courses start a new set of times and ghosts. The game carries settings, medals and cup progress forward and preserves the previous save under its original local storage key.

## GitHub Pages

The site publishes from `docs/` on `main`. The scrolling arcade guide includes three showroom angles for each of the 30 cars, track photography and route maps for all 20 courses, a body-damage comparison, camera and control guides, and an on-demand embedded game. Press Start opens race setup full page. Selecting a vehicle and course carries that pair into Free Race. The showroom, track photographs and gameplay reel come from the game renderer.
