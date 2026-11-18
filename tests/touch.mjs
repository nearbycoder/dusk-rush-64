import assert from "node:assert/strict";

// Send real multitouch contacts through Chromium's hit testing and pointer capture.
export async function verifyTouch(rpc, evaluate) {
  const settle = () =>
    evaluate(
      "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))",
    );
  const event = async (type, touchPoints = []) => {
    await rpc("Input.dispatchTouchEvent", { type, touchPoints });
    await settle();
  };
  const resizeTo = async (width, height) => {
    await rpc("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await settle();
    await evaluate("resize(); drawUI()");
  };
  const point = (name, id = 1) =>
    evaluate(`(() => {
    const b = buttons.find(b => b.id === ${JSON.stringify(name)}), r = ui.getBoundingClientRect();
    if (!b) throw Error("Missing control " + ${JSON.stringify(name)} + " on " + screen);
    return { x: r.left + (b.x + b.w/2)*S, y: r.top + (b.y + b.h/2)*S, id: ${id} };
  })()`);
  const tap = async (name) => {
    await event("touchStart", [await point(name)]);
    await event("touchEnd");
  };
  const checkLayout = async (context) => {
    const failures = await evaluate(`(() => {
      const issues = [], rects = buttons.map(b => ({ id:b.id, x:b.x*S, y:b.y*S, w:b.w*S, h:b.h*S }));
      for (const [i,b] of rects.entries()) {
        const primary = ["KeyW","KeyS","ArrowLeft","ArrowRight"].includes(b.id), min = primary ? 60 : 44;
        if (b.w < min - .01 || b.h < min - .01 || b.x < safe.left-.01 || b.y < safe.top-.01 ||
            b.x+b.w > winW-safe.right+.01 || b.y+b.h > winH-safe.bottom+.01) issues.push(b.id + " bounds");
        for (const c of rects.slice(i+1)) if (b.x < c.x+c.w-.01 && c.x < b.x+b.w-.01 &&
          b.y < c.y+c.h-.01 && c.y < b.y+b.h-.01) issues.push(b.id + "/" + c.id);
      }
      return issues;
    })()`);
    assert.deepEqual(failures, [], context);
  };
  await rpc("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await resizeTo(390, 844);
  await evaluate(
    "testMode=true; prefs.aspect=false; prefs.mode=0; change('title'); drawUI()",
  );
  await checkLayout("title");
  await tap("start");
  assert.equal(await evaluate("screen"), "setup");
  await checkLayout("setup");
  await tap("VEHICLE");
  await checkLayout("garage");
  await tap("next");
  await tap("paint");
  await tap("select");
  await tap("COURSE");
  await checkLayout("track atlas");
  await tap("next");
  await tap("track6");
  await tap("select");
  await tap("race");
  assert(await evaluate("screen==='race' && routeId===6 && touches.size===0"));
  await evaluate("countdown=0");
  const gas = await point("KeyW", 2),
    left = await point("ArrowLeft");
  await event("touchStart", [left, gas]);
  assert(await evaluate("control().steer===-1 && control().gas===1"));
  assert(await evaluate("for(let i=0;i<25;i++)step(dt); pl.speed>1"));
  const right = await point("ArrowRight"),
    boost = await point("ShiftLeft", 2),
    drift = await point("Space", 2);
  await event("touchMove", [right, boost]);
  assert(
    await evaluate(
      "step(dt); control().steer===1 && control().boost && pl.boosting && control().gas===1",
    ),
  );
  await event("touchMove", [right, drift]);
  assert(
    await evaluate(
      "control().steer===1 && control().hand && control().gas===1 && !control().boost",
    ),
  );
  // Release just the steering thumb while the other thumb remains on Drift.
  await event("touchEnd", [right]);
  assert(
    await evaluate(
      "control().steer===0 && control().hand && control().gas===1",
    ),
  );
  const brake = await point("KeyS", 2);
  await event("touchMove", [brake]);
  assert(
    await evaluate(
      "control().brake===1 && control().gas===0 && !control().hand",
    ),
  );
  await event("touchMove", [{ x: 190, y: 175, id: 2 }]);
  assert(await evaluate("control().brake===0 && control().gas===0"));
  await event("touchMove", [gas]);
  assert.equal(await evaluate("control().gas"), 1);
  await event("touchCancel");
  assert(
    await evaluate(
      "touches.size===0 && pendingTaps.size===0 && control().gas===0",
    ),
  );
  await tap("camera");
  assert.equal(await evaluate("cam"), 1);
  await tap("recover");
  assert(await evaluate("pl.recovery>0"));
  await event("touchStart", [gas, await point("pause")]);
  await event("touchEnd");
  assert(
    await evaluate("screen==='pause' && touches.size===0 && control().gas===0"),
  );
  await checkLayout("pause");
  await tap("action1");
  await checkLayout("settings");
  await tap("guide"); await checkLayout("driving guide");
  assert.equal(await evaluate("guideInputs[guideInput]"),"Touch");
  await tap("method"); assert.equal(await evaluate("guideInputs[guideInput]"),"Gamepad");
  await tap("closeGuide"); assert.equal(await evaluate("modal"),"settings");
  await tap("close");
  await tap("action0");
  const cancelTap = await point("recover");
  await evaluate("pl.recovery=0");
  await event("touchStart", [cancelTap]);
  await event("touchMove", [{ x: 190, y: 175, id: 1 }]);
  await event("touchEnd");
  assert.equal(await evaluate("pl.recovery"), 0);
  await event("touchStart", [await point("KeyW")]);
  await resizeTo(844, 390);
  assert(await evaluate("touches.size===0 && control().gas===0"));
  await event("touchEnd");
  for (const [width, height] of [
    [286, 488],
    [320, 520],
    [360, 640],
    [375, 270],
    [640, 320],
    [844, 390],
    [768, 1024],
  ]) {
    await resizeTo(width, height);
    for (const sc of [
      "title",
      "setup",
      "garage",
      "tracks",
      "pause",
      "results",
      "race",
    ]) {
      await evaluate(
        `results={rank:1,time:41,best:true}; change('${sc}'); drawUI()`,
      );
      await checkLayout(width + "x" + height + " " + sc);
    }
  }
  // Classic display letterboxes the world; targets still use the full safe area.
  await resizeTo(844, 390);
  await evaluate(`for (const [side,v] of Object.entries({left:47,right:47,top:0,bottom:21}))
    cab.style.setProperty("--safe-"+side,v+"px"); prefs.aspect=true; resize(); drawUI()`);
  await checkLayout("notched landscape, 4:3");
  assert(
    await evaluate(`Math.abs(world.width/world.height-4/3)<.01 && safe.left===47 &&
    getComputedStyle(ui).webkitTapHighlightColor==="rgba(0, 0, 0, 0)" &&
    getComputedStyle(ui).userSelect==="none" &&
    !ui.dispatchEvent(new Event("contextmenu",{bubbles:true,cancelable:true}))`),
  );
  await event("touchStart", [await point("KeyW")]);
  await evaluate("window.dispatchEvent(new Event('blur')); drawUI()");
  await event("touchEnd");
  assert(
    await evaluate(
      "screen==='pause' && control().gas===0 && pendingTaps.size===0 && !getSelection().toString()",
    ),
  );
  await evaluate(`for (const side of Object.keys(safe)) cab.style.removeProperty("--safe-"+side);
    prefs.aspect=false; clearControls()`);
  await rpc("Emulation.setTouchEmulationEnabled", { enabled: false });
  await rpc("Emulation.clearDeviceMetricsOverride");
  await evaluate("resize();drawUI()");
  console.log(
    "Mobile layouts, physical hit sizes, two-thumb driving, sliding, cancellation, safe areas and tap highlight passed.",
  );
}
