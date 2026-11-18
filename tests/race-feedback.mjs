// Run inside the game so cues, timing, materials and controls use the production code paths.
export function verifyRaceFeedback() {
  const check = (ok, why) => {
    if (!ok) throw Error(why);
  };
  Object.assign(prefs, structuredClone(defaults), { mode: 2, car: 3 });
  startRace();
  countdown = 0;
  const idle = { gas: 0, brake: 0, steer: 0, boost: false, hand: false };
  const max = cars[pl.id][6];
  pl.speed = max * 1.19;
  drive(pl, idle, dt);
  check(pl.speed > max * 1.17, "Boost release discarded speed");
  pl.boost = 1.1;
  pl.speed = 30;
  drive(pl, { ...idle, gas: 1, boost: true }, dt);
  check(pl.boostEmpty, "Empty boost latch");
  pl.boost = 9;
  drive(pl, { ...idle, gas: 1, boost: true }, dt);
  check(!pl.boosting, "Held empty boost surged");
  drive(pl, idle, dt);
  drive(pl, { ...idle, gas: 1, boost: true }, dt);
  check(pl.boosting, "Recharged boost did not re-arm");
  check(
    atlasFor(rte) === atlasFor(rte) &&
      paceNotes.every((n) => n.filter((q) => q.type === "cut").length === 2),
    "Course navigation caches or shortcut notes",
  );
  pl.s = rte.cuts[0].a - 0.5;
  pl.cut = -1;
  pl.speed = 28;
  check(
    upcomingNote()?.type === "cut" && upcomingNote().side === rte.cuts[0].side,
    "Shortcut entry advice",
  );
  pl.cut = 0;
  pl.s = rte.cuts[0].b - 2;
  check(upcomingNote()?.type === "merge", "Shortcut merge advice");
  startRace();
  for (let i = 0; i < 24000 && screen === "race"; i++) step(dt, true);
  check(
    results?.best &&
      results.bestLap > 0 &&
      results.topSpeed > 15 &&
      raceLog.laps.length === 3,
    "Race telemetry",
  );
  const tape = prefs.ghosts[0],
    encoded = packGhost(tape),
    decoded = readGhost(encoded, rte);
  check(
    decoded?.length === tape.length &&
      readGhost(tape, rte) === tape &&
      !readGhost("g1.bad", rte),
    "Ghost save round trip or legacy tape",
  );
  check(
    decoded.every((p, i) =>
      p.every((v, k) => Math.abs(v - tape[i][k]) < 0.006),
    ),
    "Ghost precision",
  );
  const branch = rte.cuts[0];
  const mainSample = [5, branch.a - 0.4, branch.side * rte.width * 0.58, 0, -1, 0];
  const cutSample = [5.1, branch.a + 3, 0.25, 1.2, 0, 0];
  const legacy = readGhost(packGhost([mainSample, cutSample]), rte);
  const cutEnd = point({s: cutSample[1], x: cutSample[2], air: cutSample[3], cut: 0});
  const endPose = ghostView(legacy[0], legacy[1], 1);
  const posed = ghostView([...mainSample, 0.3, 0.4, -0.5], [...cutSample, 0, 0.2, -0.4], 0.5);
  check(
    encoded.startsWith("g2.") && decoded.some((p) => Math.abs(p[7]) > 0.04) &&
      legacy[0].length === 6 && Math.hypot(endPose.x - cutEnd.x, endPose.z - cutEnd.z) < 0.01 &&
      Math.abs(posed.pitch - 0.3) < 0.001 && Math.abs(posed.roll + 0.45) < 0.001,
    "Ghost branch transition, attitude or backwards compatibility",
  );
  check(prefs.timeTrials[0].splits.length === 24, "Missing timed split");
  prefs.car = 8;
  startRace();
  countdown = 0;
  elapsed = prefs.timeTrials[0].splits[0] + 0.25;
  pl.s = rte.gates[0] + 0.01;
  updateProgress(pl);
  renderWorld();
  check(
    Math.abs(raceLog.split.delta - 0.25) < 1e-5 && ghostCarId === 3,
    "Split or recorded vehicle",
  );
  prefs.mode = 0;
  startRace();
  elapsed = 100;
  countdown = 0;
  pl.penalty = 3;
  finishRace(pl);
  check(
    pl.finish === 103 && screen === "race" && !results,
    "Penalty prematurely settled finish",
  );
  elapsed = 102;
  finishRace(vehicles[1]);
  elapsed = 103;
  classifyFinish();
  check(
    screen === "results" && results.rank === 2 && results.penalty === 3,
    "Penalty did not affect placing",
  );
  startRace();
  countdown = 0;
  pl.s = rte.len * 0.2;
  pl.speed = 56;
  pl.inv = 0;
  hit(pl, 0, 180);
  step(dt);
  followCamera(0, true);
  renderWorld();
  check(
    pl.recovery > 0 &&
      bits.length >= 3 &&
      fxOrder.length > 0 &&
      bits
        .filter((b) => b.model)
        .every((b) => b.liveryOrigin.every(Number.isFinite)) &&
      gl.getError() === gl.NO_ERROR,
    "Wreck fragments and particle batch",
  );
  prefs.mode = 2;
  startRace();
  countdown = 0;
  elapsed = 9;
  pl.safe = pl.s;
  recover(pl);
  check(
    ghostTape.at(-1)[0] === 12 && ghostTape.at(-2)[0] === 11.99,
    "Ghost timing after recovery",
  );
  // Replacing a rounded sample from the stripe tick must preserve a readable save.
  delete prefs.records["2-0"];
  elapsed = 12.001;
  ghostTape.push([15.01, rte.len - 0.5, 0, 0, -1, 2]);
  pl.s = rte.len + 0.4;
  pl.tickStart = { s: rte.len - 0.1 };
  finishRace(pl);
  const stripeTape = readGhost(packGhost(prefs.ghosts[0]), rte);
  check(
    stripeTape && Math.abs(stripeTape.at(-1)[0] - pl.finish) < 0.001,
    "Interpolated finish broke ghost playback after a reload",
  );
  prefs.mode = 3;
  startRace();
  elapsed = 42;
  score = 567;
  finishRace(pl);
  check(
    prefs.wreckScores[0] === 567 && results.wreckBest,
    "Wreck high score missing",
  );
  startRace();
  elapsed = 38;
  score = 100;
  finishRace(pl);
  check(
    prefs.wreckScores[0] === 567 && !results.wreckBest,
    "Wreck high score regressed",
  );
  check(availableLiveries().length === 2, "Fresh paint options");
  prefs.mode = 1;
  prefs.cup = 2;
  prefs.cups[2] = { round: 3, points: 31 };
  startRace();
  elapsed = 38;
  finishRace(pl);
  check(
    results.unlocked === liveries[4] && availableLiveries().includes(4),
    "Cup paint unlock",
  );
  // In bumper view the last draw can be a sector deleted by the next race.
  renderWorld();
  draw(sectors[1]);
  startRace();
  sky(palettes.sunset, 0.5, 0.66);
  check(
    gl.getError() === gl.NO_ERROR,
    "Fullscreen draw reused a released course buffer",
  );
  // Sample the real GPU read/draw paths across a ring wrap and a scrub.
  prefs.mode = 2;
  startRace();
  countdown = 0;
  pl.lap = 2;
  const pixels = new Uint8Array(4);
  for (let i = 0; i < replayFrames + 3; i++) {
    clock += 0.11;
    gl.clearColor(i / 255, 0.25, 0.7, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    recordFinishFrame();
  }
  check(
    filmCount === replayFrames,
    "Replay capture failed or grew past its limit",
  );
  elapsed = 71;
  finishRace(pl);
  const finish = results;
  beginReplay();
  drawUI();
  check(
    screen === "replay" && accessMenu.querySelector('input[type="range"]'),
    "Missing replay controls",
  );
  for (const i of [0, 23, replayFrames - 1]) {
    filmCursor = i / replayHz;
    drawReplay();
    gl.readPixels(
      world.width >> 1,
      world.height >> 1,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    check(
      Math.abs(pixels[0] - (i + 3)) <= 1 && Math.abs(pixels[2] - 179) <= 1,
      "Replay frame out of order",
    );
  }
  const slider = accessMenu.querySelector("input");
  slider.value = "1.3";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  check(filmPaused && filmCursor === 1.3, "Accessible replay scrubbing");
  accessMenu.querySelector('[data-action="done"]').click();
  check(
    screen === "results" && results === finish,
    "Replay changed race result",
  );
  prefs.mode = 4;
  startRace();
  pl.lap = 2;
  recordFinishFrame();
  check(filmCount === 0, "Free drive allocated replay frames");
  startRace();
  countdown = 0;
  for (let k = 0; k < 360; k++) step(dt, true);
  pause();
  openPhoto();
  drawUI();
  const frozenTime = elapsed,
    frozenProgress = pl.progress;
  const print = photoPrint();
  check(
    print.width >= world.width &&
      print.height >= world.height &&
      !firstWall(cameraProbe(photoView().eye), cameraProbe(photoView().eye)),
    "Invalid photo or camera",
  );
  for (let k = 0; k < 70; k++) {
    photoYaw += 0.1;
    step(dt);
    renderWorld();
  }
  check(
    elapsed === frozenTime && pl.progress === frozenProgress,
    "Photo mode advanced race",
  );
  leavePhoto();
  pause();
  check(screen === "race", "Could not return from photo mode");
  prefs.sound = true;
  soundOn();
  startRace();
  mixRaceAudio();
  pause();
  prefs.sound = false;
  check(
    audio && gain && audio.state !== "closed",
    "Audio graph failed to initialise",
  );
  check(gl.getError() === gl.NO_ERROR, "Race rendering error");
  return true;
}
