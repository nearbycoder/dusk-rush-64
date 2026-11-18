// Hold each combination for several ticks, including steering while braking,
// countersteering on boost, camera changes, and recovery between checkpoints.
export function verifyMixedInputs(track) {
  Object.assign(prefs, structuredClone(defaults), {
    mode: 3,
    track,
    damage: 2,
    car: (track * 7) % 30,
  });
  let seed = (track + 1) * 21401;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let contacts = 0,
    checks = 0,
    resets = 0,
    frames = 0,
    jumps = 0,
    jam = 0;
  let baseline = 0,
    previousAir = 0;
  startRace();
  for (let i = 0; i < 10800; i++) {
    if (screen === "results" || i === 5400) {
      startRace();
      previousAir = baseline = jam = 0;
      resets++;
    }
    if (i % 37 === 0) {
      keys.clear();
      if (random() < 0.95) keys.add("KeyW");
      if (random() < 0.13) keys.add("KeyS");
      if (random() < 0.58) keys.add("ShiftLeft");
      if (random() < 0.31) keys.add("Space");
      const steer = random() < 0.44 ? ai(pl).steer : random() * 2 - 1;
      if (steer < -0.22) keys.add("KeyA");
      if (steer > 0.22) keys.add("KeyD");
      if (random() < 0.29) cam = (cam + 1) % 3;
      jam =
        Math.abs(pl.s - baseline) < 1 && !pl.recovery && !countdown
          ? jam + 1
          : 0;
      if (jam > 6 || random() < 0.012) {
        manual();
        jam = 0;
      }
      baseline = pl.s;
    }
    const damaged = pl.damage.reduce((sum, v) => sum + v, 0);
    step(dt);
    if (pl.damage.reduce((sum, v) => sum + v, 0) > damaged + 0.001) contacts++;
    if (pl.air > 0.2 && previousAir <= 0.2) jumps++;
    previousAir = pl.air;
    const body = hull(pl);
    if (
      firstWall(body, body) ||
      ![pl.s, pl.x, pl.air, pl.roll, pl.speed, ...raceView.eye].every(
        Number.isFinite,
      )
    )
      throw Error(
        rte.t[0] + " overlap or unstable car at tick " + i + " station " + pl.s,
      );
    if (i % 24 === 0) {
      const probe = cameraProbe(raceView.eye);
      if (firstWall(probe, probe))
        throw Error(rte.t[0] + " obstructed camera at tick " + i);
      checks++;
    }
    if (i % 180 === 0) {
      renderWorld();
      drawUI();
      if (gl.getError() || fx.length > particleCap || bits.length > 28)
        throw Error(rte.t[0] + " effect or WebGL error");
      frames++;
    }
  }
  keys.clear();
  return { contacts, jumps, checks, frames, resets };
}
