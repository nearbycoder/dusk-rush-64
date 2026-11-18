// Render the public site's photographs with the same mesh, shaders and paint as the game.
export function photographShowroomCar(id) {
  testMode = true;
  screen = "garage";
  prefs.livery = 0;
  clock = 1;
  const paint = paints[[0, 3, 2, 1, 4, 6][id % 6]];
  const vertices = [];
  reset();
  carMesh(vertices, id, paint, undefined, 0, true);
  // At each height, the furthest vertex sweeps a circle. Fit the whole rotation
  // once so the camera never zooms or recentres as you drag a long bonnet around.
  const bands = new Map();
  for (let i = 0; i < vertices.length; i += 9) {
    const y = Math.round((vertices[i + 1] + 0.015) * 40) / 40;
    const radius = Math.hypot(vertices[i], vertices[i + 2]);
    bands.set(y, Math.max(radius, bands.get(y) || 0));
  }
  const tileW = 630, tileH = 287, fov = 0.73, focal = 1 / Math.tan(fov / 2);
  const height = vehicleBounds(id).high;
  const aim = [0, height * 0.5, 0], eye = [0, 1.13 + height * 0.46, -4.0];
  let offsetY = 0;
  for (let fit = 0; fit < 85; fit++, eye[2] -= 0.065) {
    const forward = unit(aim.map((v, i) => v - eye[i]));
    let leftRight = 0, low = Infinity, high = -Infinity;
    for (const [y, radius] of bands) for (let i = 0; i < 72; i++) {
      const x = radius * Math.sin(i * TAU / 72), z = radius * Math.cos(i * TAU / 72) - eye[2];
      const dy = y - eye[1], depth = dy * forward[1] + z * forward[2];
      const projectedY = (dy * forward[2] - z * forward[1]) * focal / depth;
      low = Math.min(low, projectedY);
      high = Math.max(high, projectedY);
      leftRight = Math.max(leftRight, Math.abs(x * focal * tileH / (depth * tileW)));
    }
    if (leftRight < 0.89 && high - low < 1.66) {
      offsetY = -(low + high) * 0.5;
      break;
    }
    if (fit === 84) throw Error("Could not frame " + names[id]);
  }
  function render(angle, impact = false) {
    gl.viewport(0, 0, world.width, world.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(studioP);
    drawFullscreen();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    camera(eye, aim, fov, 0, offsetY, rgb("#69717d"), 0.002);
    draw(displayStand);
    if (!impact) {
      heroCar(angle, id, paint);
      return;
    }
    const crushed = [];
    reset();
    carMesh(crushed, id, paint, [0.94, 0.02, 0.77, 0.06, 0.04], 4 | 1 | 512);
    const wreck = vehicleMesh(crushed);
    modelPose({ x: 0, y: 0.015, z: 0, a: angle });
    blendShadow(() => draw(heroShadow));
    draw(wreck);
    gl.deleteBuffer(wreck.buf);
  }
  const sheet = document.createElement("canvas");
  sheet.width = 6 * tileW;
  sheet.height = 4 * tileH;
  const ctx = sheet.getContext("2d", {alpha:false});
  const shots = {};
  world.width = 900;
  world.height = 410;
  for (let index = 0; index < 24; index++) {
    render(-3 * Math.PI / 4 + index * TAU / 24);
    ctx.drawImage(world, (index % 6) * tileW, Math.floor(index / 6) * tileH, tileW, tileH);
    if ([0, 3, 6].includes(index)) {
      const name = ["front", "side", "rear"][index / 3];
      shots["showroom/" + id + "-" + name] = world.toDataURL("image/webp", 0.89);
      if (index === 0) {
        const thumb = document.createElement("canvas");
        thumb.width = 280;
        thumb.height = 154;
        const thumbnail = thumb.getContext("2d");
        thumbnail.drawImage(world, 77, 0, 746, 410, 0, 0, 280, 154);
        shots["car-" + id] = thumb.toDataURL("image/webp", 0.86);
      }
    }
  }
  shots["turntables/" + id] = sheet.toDataURL("image/webp", 0.8);
  if (id === 12) {
    render(-3 * Math.PI / 4, true);
    shots["spectre-impact"] = world.toDataURL("image/webp", 0.89);
  }
  if (gl.getError() !== gl.NO_ERROR) throw Error("WebGL error photographing " + names[id]);
  return shots;
}
