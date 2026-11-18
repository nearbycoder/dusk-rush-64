# Dusk Rush ’64

[Visit the arcade](https://nearbycoder.github.io/dusk-rush-64/) or [play directly](https://nearbycoder.github.io/dusk-rush-64/play/).

For offline play, open **docs/play/index.html** in a WebGL2-capable browser. The game runs offline with no installation, build step, libraries, fonts or asset downloads.

Choose a mode, select a course and vehicle, then launch the race. All 20 courses, 30 vehicles and eight paint colours are available immediately. Factory paint and Club stripes are available from the start. Each of the five championship cups unlocks another livery and saves after every round. Time Attack records the car, path and checkpoint splits from your best completed run. Wreck Run keeps a high score for each course. Records, liveries and cup progress stay in this browser.

The route arrow calls out upcoming bends, launch ramps and shortcuts. The atlas traces both branches of every course. After a timed finish, choose **Watch finish** to scrub the last six seconds. During a race, pause and open **Photo mode** to orbit your car and save a locally rendered PNG.

Time Attack ghosts follow the recorded car’s line, drift angle, pitch and roll. A recovery adds three seconds to its clock. Split times and finishing positions use the instant each car crosses the gate. In Settings, **Full screen** expands the game on browsers that support it.

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

A standard gamepad uses its left stick to steer, triggers to accelerate and brake, left shoulder for boost, and the west face button for the handbrake. The north face button changes camera, Select recovers, and Start pauses. Sound is off initially and can be enabled in Settings. The Driving guide in the pause menu and Settings covers keyboard, touch and gamepad controls.

On a touchscreen, steer with your left thumb and hold Gas with your right. Slide between the arrows to change direction, or from Gas to Boost or Drift to keep the throttle open. Hold Brake to slow down and reverse. Tap View to cycle cameras, Recover to return to the road, or the pause icon to open the menu.

## Verification

Run `node tests/verify.mjs` with Node 22+ and Chrome installed. Set `CHROME` to the browser executable if it is outside the detected locations. The test launches a temporary headless browser profile, exercises the fixed-timestep simulation and writes PNG screenshots to `captures/`. Each numbered car and track capture follows the order in the selectors. The suite also reads the uploaded WebGL triangles and checks the camera near plane and moving car bodies against the rendered courses. It runs all 20 tracks at each difficulty and completes all five cups.

Run `node tests/verify.mjs --feedback` to check finish classification, replay frame order, ghost timing, livery unlocks, recorded splits, keyboard navigation and recovery from a lost WebGL context.

Run `node tests/verify.mjs --touch` for the mobile checks alone. They exercise simultaneous steering and pedals, thumb slides, interrupted gestures, menu navigation, portrait and landscape layouts, and safe-area insets. The two iPhone screenshots in `captures/` show the published game during native Safari touch gestures in an iPhone 18 Pro simulator.

For a real-time browser run, use `node tests/verify.mjs --endurance=120`. It rotates courses, cars, cameras and race rules, checks the finish film, and reports frame intervals over 50 ms. It completes the current race when the requested duration expires.

Run `node tests/verify.mjs --stress` for another simulated hour of mixed steering, braking, drifting, jumps, damage and recovery across every course. To exercise the published arcade, run `node tests/verify.mjs --site=https://nearbycoder.github.io/dusk-rush-64/`. The same check accepts a local HTTP server serving `docs/`.

The revised courses start a new set of times and ghosts. The game carries settings, medals and cup progress forward and preserves the previous save under its original local storage key.

## GitHub Pages

The site publishes from `docs/` on `main`. Drag any of the 30 cars through a full rotation, or focus the car and use the arrow keys. Each turntable loads when you first rotate that model. The arcade also includes track photography and route maps for all 20 courses, a body-damage comparison, camera and control guides, and an on-demand embedded game. Press Start opens race setup full page. Selecting a vehicle and course carries that pair into Free Race. The showroom, track photographs and gameplay reel come from the game renderer.

Run `node tests/verify.mjs --photograph-showroom` to regenerate all 720 rotation views, the three high-resolution presets per car, the thumbnails and the matching Spectre S impact photograph from the current vehicle meshes.
