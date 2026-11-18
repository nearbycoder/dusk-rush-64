// Inspect triangles uploaded to WebGL, independently of the driving collision grid.
// This function runs in the browser, with a fresh world for each course.
export function auditCourse(track) {
  Object.assign(prefs, structuredClone(defaults), {
    track,
    mode: 4,
    car: [12, 19, 27][track % 3],
  });
  startRace();
  const faces = new Map(),
    fails = [],
    seenTypes = new Map();
  let views = 0,
    bodyProbes = 0,
    portals = 0,
    impacts = 0,
    highestYawStep = 0;
  function failure(kind, details) {
    seenTypes.set(kind, (seenTypes.get(kind) || 0) + 1);
    if (!fails.some((f) => f.kind === kind)) fails.push({ kind, ...details });
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  for (const sector of sectors) {
    if (sector.global) continue;
    const buf = new Float32Array(sector.n * 9);
    gl.bindBuffer(gl.ARRAY_BUFFER, sector.buf);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, buf);
    for (let i = 0; i < buf.length; i += 27) {
      const a = Array.from(buf.subarray(i, i + 3)),
        b = Array.from(buf.subarray(i + 9, i + 12)),
        c = Array.from(buf.subarray(i + 18, i + 21));
      const e = sub(b, a),
        f = sub(c, a),
        n = cross(e, f),
        len = Math.hypot(...n);
      if (len < 0.00001) continue;
      const tri = {
        a,
        e,
        f,
        wall: Math.abs(n[1]) < len * 0.64,
        lo: Math.min(a[1], b[1], c[1]),
        hi: Math.max(a[1], b[1], c[1]),
      };
      cells(
        Math.min(a[0], b[0], c[0]),
        Math.min(a[2], b[2], c[2]),
        Math.max(a[0], b[0], c[0]),
        Math.max(a[2], b[2], c[2]),
        (key) => {
          let list = faces.get(key);
          if (!list) faces.set(key, (list = []));
          list.push(tri);
        },
      );
    }
  }
  // Möller–Trumbore segment/triangle test, in both winding orders.
  function crossing(from, to, onlyWalls = false) {
    const d = sub(to, from),
      y0 = Math.min(from[1], to[1]),
      y1 = Math.max(from[1], to[1]);
    let first = null;
    cells(
      Math.min(from[0], to[0]),
      Math.min(from[2], to[2]),
      Math.max(from[0], to[0]),
      Math.max(from[2], to[2]),
      (key) => {
        for (const t of faces.get(key) || []) {
          if (t.hi < y0 || t.lo > y1 || (onlyWalls && !t.wall)) continue;
          const p = cross(d, t.f),
            det = dot(t.e, p);
          if (Math.abs(det) < 1e-8) continue;
          const q = sub(from, t.a),
            u = dot(q, p) / det;
          if (u < 0 || u > 1) continue;
          const k = cross(q, t.e),
            v = dot(d, k) / det;
          if (v < 0 || u + v > 1) continue;
          const f = dot(t.f, k) / det;
          if (f > 0.0001 && f < 0.9999 && (!first || f < first.f))
            first = { f, a: t.a, e: t.e, edge: t.f };
        }
      },
    );
    return first;
  }
  function verifyView(view, cut, s) {
    const d = sub(view.look, view.eye),
      len = Math.hypot(...d);
    if (
      ![...view.eye, ...d].every(Number.isFinite) ||
      len < 1 ||
      Math.abs(d[1] / len) > 0.78
    )
      failure("invalid view", { cut, s, cam });
    // Test the eye and four near-plane corners against the *rendered* scenery.
    const forward = d.map((v) => v / len),
      right = [Math.cos(view.yaw), 0, -Math.sin(view.yaw)],
      up = cross(forward, right),
      half = 0.12 * Math.tan((cam ? 0.98 : 1.04) / 2);
    const samples = [view.eye];
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        samples.push(
          view.eye.map(
            (v, i) =>
              v +
              0.12 * forward[i] +
              ((x * half * world.width) / world.height) * right[i] +
              y * half * up[i],
          ),
        );
    for (const e of samples) {
      const hit = crossing(view.origin, e);
      if (hit) {
        failure("camera crossed drawn face", {
          cut,
          s,
          cam,
          x: pl.x,
          air: pl.air,
          hit,
          origin: view.origin,
          eye: e,
        });
        break;
      }
    }
    views++;
  }
  // Inspect both edges of each authored ribbon, the centre, all camera modes,
  // and airborne viewpoints near each ramp. Skip staging a car inside a prop.
  const segments = [[-1, 0, rte.len], ...rte.cuts.map((c, i) => [i, c.a, c.b])];
  for (const [cut, begin, end] of segments) {
    for (let s = begin + 0.05; s < end; s += 3.7) {
      for (const lane of [-1, 0, 1]) {
        Object.assign(pl, {
          s,
          cut,
          x: 0,
          drift: 0,
          air: 0,
          vy: 0,
          speed: 48,
          roll: 0,
          pitch: 0,
          lean: 0,
          spring: 0,
          dive: 0,
        });
        pl.x = lane * (lateralLimit(pl) - 0.04);
        const jump = rte.jumps.find((j) => s >= j && s < j + 65);
        if (jump !== undefined && cut < 0 && lane === 0)
          pl.air = 3.5 + 8 * Math.sin((Math.PI * (s - jump)) / 65);
        const shape = hull(pl);
        if (firstWall(shape, shape)) continue;
        for (cam = 0; cam < 3; cam++)
          verifyView(followCamera(dt, true), cut, s);
      }
    }
  }
  // Use actual local mesh vertices at the extremities of the player's body,
  // then move through every course with normal driving inputs and drift into its edges.
  const meshData = [];
  reset();
  carMesh(meshData, pl.id, pl.colour);
  const extrema = [];
  for (const x of [-1, 0, 1])
    for (const y of [-0.45, 0.45, 1])
      for (const z of [-1, 0, 1]) {
        let best = -Infinity,
          winner;
        for (let i = 0; i < meshData.length; i += 9) {
          const v = [meshData[i], meshData[i + 1], meshData[i + 2]],
            score = x * v[0] + y * v[1] + z * v[2];
          if (score > best) {
            best = score;
            winner = v;
          }
        }
        if (winner && !extrema.some((q) => q.every((n, i) => n === winner[i])))
          extrema.push(winner);
      }
  cam = 0;
  for (const [cut, begin, end] of segments) {
    for (let s = begin + 5; s < end - 6; s += 37) {
      for (const lane of [-1, 1]) {
        pl = vehicles[0] = vehicle(prefs.car, 0);
        Object.assign(pl, {
          s,
          cut,
          speed: 65,
          side: lane * 7,
          inv: 1.5,
          safe: s,
          safeCut: cut,
        });
        pl.x = lane * (lateralLimit(pl) - 1.2);
        if (firstWall(hull(pl), hull(pl))) continue;
        followCamera(dt, true);
        for (let i = 0; i < 22; i++) {
          if (pl.recovery) break;
          const before = point(pl),
            yaw = raceView.yaw,
            oldDamage = pl.damage.join();
          tick++;
          elapsed += dt;
          drive(
            pl,
            { gas: 1, brake: 0, steer: lane, hand: true, boost: true },
            dt,
          );
          const view = followCamera(dt),
            p = point(pl);
          highestYawStep = Math.max(
            highestYawStep,
            Math.abs(angleDelta(yaw, view.yaw)),
          );
          if (Math.hypot(p.x - before.x, p.z - before.z) > 3.4)
            failure("discontinuous movement", { cut, s, at: pl.s });
          verifyView(view, pl.cut, pl.s);
          if (pl.damage.join() !== oldDamage || pl.stun) impacts++;
          if (pl.recovery) continue;
          const { pitch, roll } = bodyAngles(pl, p),
            sp = Math.sin(pitch),
            cp = Math.cos(pitch),
            sr = Math.sin(roll),
            cr = Math.cos(roll),
            sa = Math.sin(p.ang + pl.drift),
            ca = Math.cos(p.ang + pl.drift);
          const center = [p.x, p.y + Math.max(0.45, cars[pl.id][2]), p.z];
          for (const [x, y, z] of extrema) {
            const X = x * cr - y * sr,
              Y = x * sr + y * cr,
              Z = z * cp - Y * sp;
            const vertex = [
              p.x + X * ca + Z * sa,
              p.y + Math.max(-0.13, pl.spring) + Y * cp + z * sp,
              p.z + Z * ca - X * sa,
            ];
            const hit = crossing(center, vertex, true);
            if (hit) {
              failure("body crossed drawn wall", {
                cut: pl.cut,
                s: pl.s,
                x: pl.x,
                id: pl.id,
                center,
                vertex,
                hit,
              });
              break;
            }
          }
          bodyProbes++;
        }
      }
    }
  }
  for (const c of rte.cuts)
    for (const [s, entering] of [
      [c.a, true],
      [c.b, false],
    ]) {
      pl = vehicles[0] = vehicle(prefs.car, 0);
      Object.assign(pl, {
        s: s - 0.22,
        x: entering ? c.side * rte.width * 0.58 : 0,
        cut: entering ? -1 : c.i,
        speed: 47,
      });
      followCamera(dt, true);
      const before = point(pl),
        yaw = raceView.yaw;
      drive(pl, { gas: 1, brake: 0, steer: 0, hand: false, boost: true }, dt);
      const after = point(pl),
        view = followCamera(dt);
      if (
        pl.cut !== (entering ? c.i : -1) ||
        Math.hypot(after.x - before.x, after.z - before.z) > 1.8 ||
        Math.abs(angleDelta(yaw, view.yaw)) > 0.074
      )
        failure("shortcut transition", { s, entering, cut: pl.cut });
      portals++;
    }
  if (highestYawStep > 3.701 * dt)
    failure("camera turn rate", { highestYawStep });
  return {
    track,
    views,
    bodyProbes,
    portals,
    impacts,
    fails,
    counts: Object.fromEntries(seenTypes),
  };
}
