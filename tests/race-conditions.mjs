// Each car is selected twice across the matrix of courses and race conditions.
export function raceConditions(track) {
  const rounds = [];
  for (let level = 0; level < 3; level++) {
    Object.assign(prefs, structuredClone(defaults), {
      track,
      difficulty: level,
      damage: level,
      mode: level === 2 ? 3 : 0,
      car: (track * 3 + level) % 30,
    });
    startRace();
    let greatestCameraStep = 0;
    for (let i = 0; i < 24000 && vehicles.some((v) => !v.finish); i++) {
      // Keep simulating the remaining field after the player's results screen.
      if (screen === "results") screen = "race";
      const eye = raceView.eye,
        penalty = pl.penalty,
        yaw = raceView.yaw;
      step(dt, true);
      if (pl.penalty === penalty) {
        const move = Math.hypot(...raceView.eye.map((x, i) => x - eye[i]));
        if (
          Math.abs(angleDelta(yaw, raceView.yaw)) > 3.71 * dt ||
          !Number.isFinite(move)
        )
          throw new Error(
            "Camera instability on " + rte.t[0] + " at station " + pl.s,
          );
        greatestCameraStep = Math.max(greatestCameraStep, move);
      }
    }
    const remaining = vehicles.filter((v) => !v.finish);
    if (remaining.length || greatestCameraStep > 3.8)
      throw new Error(
        rte.t[0] +
          " difficulty " +
          level +
          " — unfinished slots " +
          remaining.map((v) => v.slot).join(",") +
          "; maximum camera step " +
          greatestCameraStep,
      );
    rounds.push(greatestCameraStep);
  }
  return rounds;
}
