const node = (id) => document.getElementById(id);
const car = node("car");
const track = node("track");
function populate(select, items, initial) {
  select.replaceChildren(...items.map((item, i) => new Option(item.name, i)));
  select.selectedIndex = initial;
}
populate(car, catalog.cars, 12);
populate(track, catalog.tracks, 0);
function update() {
  const c = catalog.cars[car.selectedIndex],
    t = catalog.tracks[track.selectedIndex];
  node("car-count").textContent =
    String(car.selectedIndex + 1).padStart(2, "0") + " / 30";
  node("track-count").textContent =
    String(track.selectedIndex + 1).padStart(2, "0") + " / 20";
  node("car-img").src = "media/car-" + car.value + ".webp";
  node("car-img").alt = c.name + " showroom model";
  node("car-class").textContent = c.group;
  node("speed").textContent = c.speed + " km/h";
  node("weight").textContent = c.weight.toLocaleString("en-US") + " kg";
  node("district").textContent = t.district;
  node("feature").textContent = t.feature;
  node("distance").textContent = t.km + " km";
  node("format").textContent =
    t.type === "Circuit" ? "3 laps" : "Point to point";
  node("route").setAttribute("points", t.map);
  node("route-shadow").setAttribute("points", t.map);
  const [x, y] = t.map.split(" ")[0].split(",");
  node("start").setAttribute("cx", x);
  node("start").setAttribute("cy", y);
  node("launch").href = "play/?car=" + car.value + "&track=" + track.value;
  node("setup-summary").textContent = c.name + " · " + t.name;
}
for (const select of [car, track]) select.addEventListener("change", update);
for (const button of document.querySelectorAll("[data-cycle]"))
  button.addEventListener("click", () => {
    const select = node(button.dataset.cycle),
      n = select.options.length;
    select.selectedIndex =
      (select.selectedIndex + Number(button.dataset.step) + n) % n;
    update();
  });
update();

// Lit keys on the control deck select the current cabinet screen.
const panels = ["title", "garage", "courses", "manual", "film"];
const film = node("film"),
  map = node("route"),
  runner = node("racer");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let active, dashFrame;
function drawRouteMarker(time) {
  const length = map.getTotalLength();
  const p = map.getPointAtLength(((time % 5400) / 5400) * length);
  runner.setAttribute("cx", p.x);
  runner.setAttribute("cy", p.y);
  dashFrame = requestAnimationFrame(drawRouteMarker);
}
function animateMap() {
  cancelAnimationFrame(dashFrame);
  const running =
    active === "courses" && !document.hidden && !reduceMotion.matches;
  runner.style.display = running ? "" : "none";
  if (running) dashFrame = requestAnimationFrame(drawRouteMarker);
}
function show(view, focusScreen = false) {
  if (view === "controls" || view === "game") view = "manual";
  if (!panels.includes(view)) view = "title";
  active = view;
  for (const key of panels) node(key + "-panel").hidden = key !== view;
  for (const button of document.querySelectorAll(".keycap")) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.open === (view === "film" ? "title" : view),
    );
  }
  if (view !== "film") film.pause();
  animateMap();
  if (focusScreen) {
    node("screen").focus({ preventScroll: true });
    node("screen").scrollIntoView({ block: "nearest" });
  }
}
function openView(view) {
  if (location.hash === "#" + view) show(view, true);
  else location.hash = view;
}
addEventListener("hashchange", () => show(location.hash.slice(1), true));
for (const b of document.querySelectorAll("[data-open]"))
  b.onclick = () => openView(b.dataset.open);
node("replay").onclick = () => {
  show("film", true);
  film.currentTime = 0;
  film.play().catch(() => {
    /* Native controls remain available. */
  });
};
film.addEventListener("ended", () => openView("title"));
document.addEventListener("visibilitychange", animateMap);
reduceMotion.addEventListener("change", animateMap);
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
    return;
  if (e.key === "Escape" && active !== "title") {
    e.preventDefault();
    openView("title");
    return;
  }
  if (e.target.closest("button,a,select,summary,video,input")) return;
  if (e.key === "Enter" && active === "title") {
    e.preventDefault();
    node("start-game").click();
  }
});
const sprites = {
  flag: [
    "001111001100",
    "001001110011",
    "001111001100",
    "001001110011",
    "001111001100",
    "001000000000",
    "001000000000",
    "001000000000",
  ],
  car: [
    "000111111000",
    "001100001100",
    "011111111110",
    "110000000011",
    "111011110111",
    "111111111111",
    "011000000110",
  ],
  route: [
    "001111100000",
    "011000110000",
    "110000011100",
    "110000000110",
    "011100000011",
    "000111100011",
    "000000111110",
  ],
  book: [
    "111110011111",
    "100011110001",
    "101001100101",
    "100001100001",
    "101001100101",
    "100001100001",
    "111111111111",
    "000001100000",
  ],
};
for (const icon of document.querySelectorAll("[data-icon]")) {
  const rows = sprites[icon.dataset.icon],
    c = document.createElement("canvas");
  c.width = c.height = 14;
  c.setAttribute("aria-hidden", "true");
  const g = c.getContext("2d");
  g.fillStyle = getComputedStyle(icon).color;
  rows.forEach((row, y) =>
    Array.from(row).forEach((v, x) => {
      if (v === "1") g.fillRect(x + 1, y + 3, 1, 1);
    }),
  );
  icon.append(c);
}
show(location.hash.slice(1));
