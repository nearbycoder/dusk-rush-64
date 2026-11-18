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
