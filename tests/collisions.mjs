// This function is evaluated in the running game by the headless verifier.
export function verifyCollisions() {
  const passed = [];
  function check(name, condition) {
    if (!condition) throw new Error("Collision regression: " + name);
    passed.push(name);
  }
  const throttle = { gas: 1, brake: 0, steer: 0, boost: true, hand: false };
  const idle = { gas: 0, brake: 0, steer: 0, boost: false, hand: false };
  function setup(track = 0) {
    Object.assign(prefs, structuredClone(defaults), {
      mode: 4,
      track,
      damage: 0,
    });
    startRace();
    return pl;
  }
  function addWall(
    station,
    cut = -1,
    thickness = 0.06,
    offset = 0,
    bottom = 0,
    height = 4,
  ) {
    const p = path(rte, station, cut);
    const wall = solid(
      p.x + p.nx * offset,
      p.y + bottom,
      p.z + p.nz * offset,
      p.ang,
      18,
      height,
      thickness,
    );
    insertSolid(wallGrid, wall);
    return wall;
  }
  function place(v, s, cut = -1) {
    Object.assign(v, {
      s,
      cut,
      x: 0,
      speed: 0,
      side: 0,
      air: 0,
      vy: 0,
      drift: 0,
      recovery: 0,
      inv: 0,
      stun: 0,
    });
  }
  function clear(v) {
    const g = hull(v);
    return !firstWall(g, g);
  }
  let v = setup(),
    s = 50;
  const wall = addWall(s);
  place(v, s - 6);
  v.speed = 110;
  for (let i = 0; i < 105; i++) drive(v, throttle, dt);
  check(
    "boost and sustained throttle against a 6 cm wall",
    v.s < s && clear(v) && v.damage[0] > 0,
  );
  place(v, s + 4);
  v.speed = -10;
  for (let i = 0; i < 90; i++) drive(v, { ...idle, brake: 1 }, dt);
  check("reverse into the same wall", v.s > s && clear(v) && v.damage[1] > 0);
  place(v, s - 7);
  v.inv = 3;
  v.speed = 100;
  for (let i = 0; i < 20; i++) drive(v, throttle, dt);
  check("impact immunity preserves solidity", v.s < s && clear(v));
  let old = hull(v);
  let start = { ...old, x: wall.x - wall.s * 16, z: wall.z - wall.c * 16 };
  let end = { ...old, x: wall.x + wall.s * 16, z: wall.z + wall.c * 16 };
  const crossing = sweepBox(start, end, wall);
  check(
    "swept contact with both endpoints outside",
    !!crossing && crossing.t > 0 && crossing.t < 0.5,
  );
  v.safe = s;
  v.safeX = 0;
  v.safeCut = -1;
  recover(v);
  check(
    "recovery rejects a safe station occupied by a wall",
    clear(v) && v.s <= s,
  );
  v = setup();
  let road = rte.at(s),
    barrier = solid(
      road.x + road.nx * 3,
      road.y,
      road.z + road.nz * 3,
      road.ang,
      0.12,
      3,
      30,
    );
  insertSolid(wallGrid, barrier);
  place(v, s - 5);
  v.speed = 36;
  v.side = 14;
  for (let i = 0; i < 18; i++)
    drive(v, { ...throttle, steer: 1, hand: true }, dt);
  check(
    "drifting car scrapes and slides along a side wall",
    clear(v) && v.s > s && v.damage[3] > 0,
  );
  const other = vehicle(6, 1);
  place(v, s);
  place(other, s);
  v.x = 3 - 0.06 - hull(v).hw - 0.035;
  other.x = v.x - hull(v).hw - hull(other).hw + 0.35;
  v.inv = other.inv = 1;
  v.tickHull = hull(v);
  other.tickHull = hull(other);
  collideCars(v, other, dt);
  const parkedA = hull(v),
    parkedB = hull(other);
  check(
    "contact cooldown cannot push cars through a barrier or one another",
    clear(v) &&
      clear(other) &&
      !sweepBox(parkedA, parkedA, parkedB, undefined, true),
  );
  v = setup();
  const cut = rte.cuts[0],
    mid = (cut.a + cut.b) / 2;
  addWall(mid, 0);
  place(v, mid - 6, 0);
  v.speed = 80;
  for (let i = 0; i < 60; i++) drive(v, throttle, dt);
  check("shortcut uses world walls", v.cut === 0 && v.s < mid && clear(v));
  v = setup();
  const roof = addWall(s, -1, 14, 0, 3.5, 0.28);
  place(v, s - 8);
  v.speed = 35;
  for (let i = 0; i < 29; i++) drive(v, throttle, dt);
  check("grounded car passes below ceiling", v.s > s && clear(v));
  place(v, s);
  v.air = 0.2;
  v.vy = 18;
  for (let i = 0; i < 20; i++) drive(v, idle, dt);
  check(
    "airborne roof strikes underside",
    clear(v) && hull(v).y + hull(v).hh <= roof.y - roof.hh + 0.025 && v.vy <= 0,
  );
  // Exercise a real, unmodified start gantry on Golden Span, at crossbar height.
  v = setup(2);
  const p = rte.at(5),
    probe = solid(p.x, p.y + 7, p.z, p.ang, 0.4, 0.4, 0.4);
  let beam;
  staticCandidates(probe, probe, (o) => {
    if (o.hw >= rte.width && o.hl < 0.5 && Math.abs(o.y - p.y - 7.8) < 1)
      beam = o;
  });
  check("rendered start gantry registered", !!beam);
  place(v, 0);
  v.air = 7.4;
  v.vy = 1;
  v.speed = 95;
  for (let i = 0; i < 4; i++) drive(v, throttle, dt);
  check(
    "gantry crossbar stops a jumping car",
    v.s < 5 && clear(v) && v.damage[0] > 0,
  );
  v = setup(1);
  const tram = props.find((p) => p.type === "tram");
  const time = 1 + mod(-tram.s, TAU) / 0.14;
  elapsed = time;
  const center = tram.s + Math.sin(elapsed * 0.14 + tram.s) * 6;
  place(v, center + (7.28 + cars[v.id][0] + 0.1) / 2 + 0.035);
  v.x = tram.x;
  for (let i = 0; i < 40; i++) {
    elapsed += dt;
    drive(v, idle, dt);
  }
  check(
    "moving tram pushes a parked car clear",
    clear(v) && v.recovery === 0 && v.s > center + 5,
  );
  return passed;
}
