const byId = (id) => document.getElementById(id);
const cars = catalog.cars,
  tracks = catalog.tracks;
const groups = [...new Set(cars.map((car) => car.group))];
let carId = 12,
  trackId = 2,
  view = "front";
const angleNames = {
  front: "Front three-quarter",
  side: "Side profile",
  rear: "Rear three-quarter",
};
const turntable = byId("turntable"), rotation = byId("rotation-frame");
const presetFrames = { front: 0, side: 3, rear: 6 };
let rotationIndex = 0, rotationSheet, rotationSheetCar = -1, turnDrag;
function describeRotation() {
  turntable.setAttribute("aria-label", "Rotate " + cars[carId].name);
  turntable.setAttribute("aria-valuenow", rotationIndex * 15);
  turntable.setAttribute("aria-valuetext", angleNames[view] || (rotationIndex * 15 + " degrees from the starting view"));
  for (const btn of document.querySelectorAll("[data-view]"))
    btn.setAttribute("aria-pressed", btn.dataset.view === view);
}
function showRotation() {
  if (view || rotationSheetCar !== carId || !rotationSheet?.naturalWidth) return;
  const w = rotation.width, h = rotation.height;
  rotation.getContext("2d").drawImage(rotationSheet, (rotationIndex % 6) * w,
    Math.floor(rotationIndex / 6) * h, w, h, 0, 0, w, h);
  rotation.hidden = false;
}
function rotateTo(index) {
  rotationIndex = ((index % 24) + 24) % 24;
  const preset = Object.keys(presetFrames).find((name) => presetFrames[name] === rotationIndex);
  if (preset) return modelAngle(preset);
  view = null;
  describeRotation();
  if (rotationSheetCar !== carId) {
    const photo = new Image();
    rotationSheet = photo;
    rotationSheetCar = carId;
    photo.onload = () => { if (photo === rotationSheet) showRotation(); };
    photo.onerror = () => {
      if (photo !== rotationSheet) return;
      rotationSheetCar = -1;
      modelAngle("front");
    };
    photo.src = "media/turntables/" + carId + ".webp";
  }
  showRotation();
}
function releaseTurntable() {
  turnDrag = null;
  turntable.classList.remove("dragging");
}
turntable.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  turnDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: rotationIndex };
  turntable.setPointerCapture(event.pointerId);
});
turntable.addEventListener("pointermove", (event) => {
  if (turnDrag?.id !== event.pointerId) return;
  const dx = event.clientX - turnDrag.x, dy = event.clientY - turnDrag.y;
  if (!turntable.classList.contains("dragging")) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
    if (Math.abs(dy) > Math.abs(dx)) return releaseTurntable();
    turntable.classList.add("dragging");
  }
  const step = Math.max(11, turntable.clientWidth / 27);
  rotateTo(turnDrag.initial + Math.round(dx / step));
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  turntable.addEventListener(type, (event) => {
    if (turnDrag?.id === event.pointerId) releaseTurntable();
  });
window.addEventListener("blur", releaseTurntable);
turntable.addEventListener("keydown", (event) => {
  const positions = { ArrowLeft: rotationIndex - 1, ArrowDown: rotationIndex - 1,
    ArrowRight: rotationIndex + 1, ArrowUp: rotationIndex + 1, Home: 0, End: 23 };
  if (!(event.key in positions)) return;
  event.preventDefault();
  rotateTo(positions[event.key]);
});
function raceLink() {
  byId("setup-summary").textContent =
    cars[carId].name + " · " + tracks[trackId].name;
  byId("launch").href = "play/?car=" + carId + "&track=" + trackId;
}
function modelAngle(value) {
  view = value;
  rotationIndex = presetFrames[value];
  rotation.hidden = true;
  const image = byId("car-img");
  image.src = "media/showroom/" + carId + "-" + value + ".webp";
  image.alt = angleNames[value] + " view of the " + cars[carId].name;
  describeRotation();
}
function imageButton(id, label, path, select) {
  const btn = document.createElement("button"),
    img = document.createElement("img"),
    name = document.createElement("span");
  btn.type = "button";
  btn.dataset.id = id;
  btn.setAttribute("aria-label", "Select " + label);
  img.src = path;
  img.alt = "";
  img.loading = "lazy";
  name.textContent = label;
  btn.append(img, name);
  btn.addEventListener("click", () => select(id));
  return btn;
}
function selectCar(id) {
  const car = cars[id],
    strip = byId("car-strip");
  carId = id;
  releaseTurntable();
  byId("car-name").textContent = car.name;
  byId("car-note").textContent = car.note;
  byId("car-class").textContent = car.group;
  byId("speed").textContent = car.speed + " km/h";
  byId("weight").textContent = car.weight.toLocaleString("en-US") + " kg";
  byId("length").textContent = car.length.toFixed(2) + " m";
  for (const btn of byId("classes").children)
    btn.setAttribute("aria-pressed", btn.dataset.group === car.group);
  if (strip.dataset.group !== car.group) {
    strip.replaceChildren(
      ...cars.flatMap((model, i) =>
        model.group === car.group
          ? [imageButton(i, model.name, "media/car-" + i + ".webp", selectCar)]
          : [],
      ),
    );
    strip.dataset.group = car.group;
  }
  for (const btn of strip.children)
    btn.setAttribute("aria-pressed", Number(btn.dataset.id) === id);
  modelAngle(view || "front");
  raceLink();
}
for (const group of groups) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.group = group;
  b.textContent = group;
  b.onclick = () => selectCar(cars.findIndex((c) => c.group === group));
  byId("classes").append(b);
}
document
  .querySelectorAll("[data-view]")
  .forEach((btn) => (btn.onclick = () => modelAngle(btn.dataset.view)));
document.querySelectorAll("[data-inspect]").forEach(
  (btn) =>
    (btn.onclick = () => {
      view = "front";
      selectCar(Number(btn.dataset.inspect));
      location.hash = "garage";
      byId("garage").scrollIntoView();
      byId("classes")
        .querySelector("[aria-pressed=true]")
        .focus({ preventScroll: true });
    }),
);
const route = byId("route"),
  marker = byId("racer"),
  trackSelect = byId("track");
let routeLength = 0,
  mapFrame,
  mapVisible = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const branchLines = [byId("branch-0"), byId("branch-1")];
const cutButtons = [...document.querySelectorAll("[data-cut]")];
let tracedCut = -1,
  branchLength = 0;
function chooseCut(index) {
  tracedCut = index;
  const cut = tracks[trackId].cuts[index];
  branchLength = cut ? branchLines[index].getTotalLength() : 0;
  cutButtons.forEach((button, i) => {
    button.setAttribute("aria-pressed", i === index);
    branchLines[i].classList.toggle("selected", i === index);
  });
  byId("cut-detail").textContent = cut
    ? cut.surface[0].toUpperCase() +
      cut.surface.slice(1) +
      " · " +
      cut.metres +
      " m shorter"
    : "Choose a shortcut to trace its line.";
}
cutButtons.forEach(
  (button, i) => (button.onclick = () => chooseCut(tracedCut === i ? -1 : i)),
);
function traceCourse(t) {
  const cut = tracks[trackId].cuts[tracedCut];
  const join = cut ? cut.entry * routeLength : routeLength;
  const leave = cut ? cut.exit * routeLength : routeLength;
  const lap = join + branchLength + routeLength - leave;
  const s = ((t % 6500) / 6500) * lap;
  const p =
    s < join
      ? route.getPointAtLength(s)
      : cut && s < join + branchLength
        ? branchLines[tracedCut].getPointAtLength(s - join)
        : route.getPointAtLength(leave + s - join - branchLength);
  marker.setAttribute("cx", p.x);
  marker.setAttribute("cy", p.y);
  mapFrame = requestAnimationFrame(traceCourse);
}
function mapAnimation() {
  cancelAnimationFrame(mapFrame);
  const visible = mapVisible && !document.hidden && !reduced.matches;
  marker.style.display = visible ? "" : "none";
  if (visible) mapFrame = requestAnimationFrame(traceCourse);
}
function selectCourse(id) {
  trackId = id;
  trackSelect.value = id;
  const track = tracks[id],
    img = byId("course-photo");
  img.src = "media/courses/" + id + ".webp";
  img.alt = "In-game view of " + track.name + ", " + track.district;
  byId("track-name").textContent = track.name;
  byId("district").textContent = track.district;
  byId("track-count").textContent = String(id + 1).padStart(2, "0") + " / 20";
  byId("feature").textContent = track.feature;
  byId("format").textContent =
    track.type === "Circuit" ? "3 laps" : "Point to point";
  byId("distance").textContent = track.km + " km";
  route.setAttribute("points", track.map);
  byId("route-shadow").setAttribute("points", track.map);
  const [x, y] = track.map.split(" ")[0].split(",");
  byId("start").setAttribute("cx", x);
  byId("start").setAttribute("cy", y);
  routeLength = route.getTotalLength();
  track.cuts.forEach((cut, i) => {
    branchLines[i].setAttribute("points", cut.points);
    cutButtons[i].textContent = cut.name;
  });
  chooseCut(-1);
  for (const btn of byId("course-strip").children)
    btn.setAttribute("aria-pressed", Number(btn.dataset.id) === id);
  raceLink();
}
trackSelect.replaceChildren(...tracks.map((t, i) => new Option(t.name, i)));
trackSelect.onchange = () => selectCourse(Number(trackSelect.value));
for (const id of [2, 5, 13, 15])
  byId("course-strip").append(
    imageButton(
      id,
      tracks[id].name,
      "media/courses/" + id + ".webp",
      selectCourse,
    ),
  );
new IntersectionObserver(([entry]) => {
  mapVisible = entry.isIntersecting;
  mapAnimation();
}).observe(route.ownerSVGElement);
reduced.addEventListener("change", mapAnimation);
document.addEventListener("visibilitychange", mapAnimation);
selectCar(carId);
selectCourse(trackId);
const paintSample = byId("paint-sample");
const paintCups = [
  "City Lights",
  "High Country",
  "Fault Line",
  "Pacific Run",
  "Last Horizon",
];
paintSample.onchange = () => {
  const index = paintSample.selectedIndex;
  const name = paintSample.value;
  const image = byId("paint-img");
  image.src = "media/liveries/" + index + ".webp";
  image.alt = "Hammerhead V8 in the " + name + " livery";
  byId("paint-unlock").textContent =
    index < 2
      ? name + " is available on every car from the start."
      : "Finish the " + paintCups[index - 2] + " Cup to unlock " + name + ".";
};
for (const btn of document.querySelectorAll("[data-damage]"))
  btn.onclick = () => {
    const damaged = btn.dataset.damage === "1",
      img = byId("damage-img");
    img.src = damaged
      ? "media/spectre-impact.webp"
      : "media/showroom/12-front.webp";
    img.alt = damaged
      ? "Spectre S with its front bumper detached and side bodywork crumpled"
      : "Factory Spectre S with straight panels and an intact front bumper";
    for (const b of document.querySelectorAll("[data-damage]"))
      b.setAttribute("aria-pressed", b === btn);
  };
const reel = byId("reel"),
  film = byId("film");
byId("watch").onclick = () => {
  reel.showModal();
  film.currentTime = 0;
  film.play().catch(() => {});
};
byId("close-reel").onclick = () => reel.close();
reel.addEventListener("close", () => film.pause());
const poster = byId("player-poster"),
  stop = byId("stop-game");
byId("embed-start").onclick = () => {
  if (byId("play-frame")) return;
  const frame = document.createElement("iframe");
  frame.id = "play-frame";
  frame.title = "Dusk Rush ’64 playable arcade";
  frame.src = "play/?start";
  frame.allowFullscreen = true;
  frame.allow = "gamepad; fullscreen";
  poster.hidden = true;
  stop.hidden = false;
  frame.addEventListener("load", () => frame.focus(), { once: true });
  byId("player").append(frame);
  if (matchMedia("(pointer: coarse)").matches)
    byId("player").scrollIntoView({ block: "center", behavior: "instant" });
};
stop.onclick = () => {
  byId("play-frame")?.remove();
  poster.hidden = false;
  stop.hidden = true;
  byId("embed-start").focus();
};
if (location.hash === "#manual") location.replace("#controls");
