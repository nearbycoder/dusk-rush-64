// These checks use the fixed-step camera and collision path used in a live race.
export function verifyCameraAndContacts() {
  const passed = [];
  const check = (name, condition) => {
    if (!condition) throw new Error(name);
    passed.push(name);
  };
  function start(track = 0, id = 12) {
    Object.assign(prefs, structuredClone(defaults), {
      track,
      car: id,
      mode: 4,
    });
    startRace();
    return pl;
  }
  const gas = { gas: 1, brake: 0, steer: 0, boost: true, hand: false };
  let v = start(4),
    c = rte.cuts[0];
  v.s = c.a - 0.3;
  v.x = c.side * rte.width * 0.58;
  v.speed = 47;
  for (cam = 0; cam < 3; cam++) {
    v.s = c.a - 0.3;
    v.x = c.side * rte.width * 0.58;
    v.cut = -1;
    v.speed = 47;
    const q = followCamera(dt, true),
      eye = q.eye.slice(),
      yaw = q.yaw;
    step(dt);
    check(
      "Lombard shortcut keeps camera " + cam + " continuous",
      v.cut === 0 &&
        Math.abs(angleDelta(yaw, raceView.yaw)) < 0.07 &&
        Math.hypot(...raceView.eye.map((n, i) => n - eye[i])) < 1.8,
    );
  }
  v = start();
  v.s = 51;
  v.x = 0.01;
  const q = followCamera(dt, true),
    eye = q.eye.slice();
  hit(v, 0, 13);
  v.x = -0.01;
  followCamera(dt);
  check(
    "crossing the centreline after an impact does not swing the view",
    Math.hypot(...raceView.eye.map((n, i) => n - eye[i])) < 0.1,
  );
  const originalEye = raceView.eye.slice();
  pause();
  for (let i = 0; i < 180; i++) step(dt);
  check(
    "paused camera remains still",
    screen === "pause" && raceView.eye.every((n, i) => n === originalEye[i]),
  );
  pause();
  for (const j of [0, 1, 2]) {
    cam = j;
    renderWorld();
    check(
      "camera switch " + j + " takes effect on the next render",
      raceView.mode === j && raceView.eye.every(Number.isFinite),
    );
  }
  v = start();
  v.s = 51;
  const p = point(v),
    roof = p.y + 3.8;
  buildWalls = { s: 400, cut: 0, pavement: true };
  const pt = (x, z) => [p.x + x, roof, p.z + z];
  addSurface(pt(-8, -8), pt(8, -8), pt(8, 8));
  addSurface(pt(-8, -8), pt(8, 8), pt(-8, 8));
  buildWalls = null;
  const idle = { ...gas, gas: 0, boost: false };
  v.air = 0.4;
  v.vy = 28;
  v.speed = 0;
  let max = -Infinity;
  for (let i = 0; i < 16; i++) {
    drive(v, idle, dt);
    const g = hull(v);
    max = Math.max(max, g.y + g.hh);
  }
  check(
    "car cannot jump through the underside of another road",
    max <= roof + 0.025,
  );
  v.air = 6;
  v.vy = -18;
  for (let i = 0; i < 70; i++) drive(v, idle, dt);
  const landed = hull(v);
  check(
    "car lands on an intersecting road from above",
    Math.abs(landed.y - landed.hh - roof) < 0.065,
  );
  v = start();
  const other = vehicle(6, 1);
  v.s = 50;
  other.s = 62;
  v.x = other.x = 0;
  v.tickStart = motionState(v);
  other.tickStart = motionState(other);
  v.tickHull = hull(v);
  other.tickHull = hull(other);
  v.s = 65;
  other.s = 47;
  v.speed = 70;
  other.speed = -10;
  const bounced = collideCars(v, other, dt);
  check(
    "complete swept pass cannot swap two cars",
    bounced && v.s < other.s && !sweepBox(hull(v), hull(v), hull(other)),
  );
  v = start();
  v.s = 50;
  const wallCar = vehicle(6, 1);
  wallCar.s = 54;
  wallCar.x = v.x;
  wallCar.recovery = 1;
  v.speed = 40;
  v.inv = 1;
  const wallStart = wallCar.s;
  for (let i = 0; i < 12; i++) {
    for (const a of [v, wallCar]) {
      a.tickStart = motionState(a);
      a.tickHull = hull(a);
    }
    drive(v, gas, dt);
    collideCars(v, wallCar, dt);
  }
  check(
    "an immobile wreck stops a live racer during the recovery countdown",
    wallCar.s === wallStart &&
      v.s < wallCar.s &&
      !sweepBox(hull(v), hull(v), hull(wallCar)),
  );
  v = start(16);
  const j = rte.jumps[0];
  v.safe = j + 1;
  v.safeCut = -1;
  recover(v);
  check(
    "recovery cannot repeatedly seed a car into an open gap",
    v.s < j - 39 && v.recovery === 0,
  );
  v = start(12);
  v.s = rte.len - 0.3;
  v.speed = 76;
  v.gate = 7;
  step(dt);
  const last = point(v);
  for (let i = 0; i < 30; i++) step(dt);
  check(
    "Free Drive stays at the open course endpoint",
    pl.s > rte.len - 1 &&
      Math.hypot(last.x - point(v).x, last.z - point(v).z) < 0.1,
  );
  v = start(1, 12);
  v.s = 50;
  cam = 2;
  followCamera(0, true);
  renderWorld();
  const pixels = () => {
    const data = new Uint8Array(world.width * world.height * 4);
    gl.readPixels(
      0,
      0,
      world.width,
      world.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    return data;
  };
  const bonnet = pixels(),
    model = v.model;
  v.model = { ...model, n: 0, solid: 0 };
  renderWorld();
  const roadOnly = pixels();
  v.model = model;
  let hood = 0,
    aboveHorizon = 0;
  for (let i = 0; i < bonnet.length; i += 4) {
    if (
      bonnet[i] !== roadOnly[i] ||
      bonnet[i + 1] !== roadOnly[i + 1] ||
      bonnet[i + 2] !== roadOnly[i + 2]
    ) {
      hood++;
      if (i > bonnet.length * 0.55) aboveHorizon++;
    }
  }
  check(
    "bonnet camera shows the painted hood beneath a clear road view",
    hood > world.width * world.height * 0.025 &&
      hood < world.width * world.height * 0.36 &&
      aboveHorizon === 0,
  );
  const poses = [
    [0, 0, 0],
    [0.43, -0.25, 0.45],
    [-0.67, 0.39, -0.42],
    [2.65, -0.17, 0.2],
  ];
  for (let id = 0; id < 30; id++) {
    const car = vehicle(id, 0);
    car.s = 54;
    const data = [];
    reset();
    carMesh(data, id, car.colour);
    for (const [roll, pitch, drift] of poses) {
      Object.assign(car, { roll, pitch, drift, air: 3 });
      const g = hull(car),
        p = point(car),
        a = bodyAngles(car, p),
        cr = Math.cos(a.roll),
        sr = Math.sin(a.roll),
        cp = Math.cos(a.pitch),
        sp = Math.sin(a.pitch);
      const gear = runningGear(id);
      for (let i = 0; i < data.length; i += 9) {
        let x = data[i],
          y = data[i + 1],
          z = data[i + 2];
        const group = Math.floor(data[i + 8] / 32);
        if (group) {
          const hubX = (group % 2 === 0 ? 1 : -1) * gear.x,
            hubZ = group <= 2 ? gear.front : gear.rear;
          const yy = y - gear.radius,
            zz = z - hubZ,
            xx = x - hubX;
          const wz = zz * 0.8 + yy * 0.6,
            wx = xx;
          y = gear.radius + yy * 0.8 - zz * 0.6;
          x = hubX + wx;
          z = hubZ + wz;
          if (group <= 2) {
            x = hubX + wx * Math.cos(0.33) + wz * Math.sin(0.33);
            z = hubZ + wz * Math.cos(0.33) - wx * Math.sin(0.33);
          }
        }
        const X = x * cr - y * sr,
          Y = x * sr + y * cr,
          Z = z * cp - Y * sp,
          wy = p.y + Y * cp + z * sp;
        const dx = p.x + X * g.c + Z * g.s - g.x,
          dz = p.z + Z * g.c - X * g.s - g.z;
        if (
          Math.abs(dx * g.c - dz * g.s) > g.hw + 0.001 ||
          Math.abs(dx * g.s + dz * g.c) > g.hl + 0.001 ||
          Math.abs(wy - g.y) > g.hh + 0.001
        )
          throw new Error(
            "Car geometry outside impact hull: " + names[id] + " / " + group,
          );
      }
    }
  }
  passed.push(
    "30 vehicle meshes fit their impact hull in 120 steered, pitched and rolled poses",
  );
  return passed;
}
