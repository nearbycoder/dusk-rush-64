import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";

export async function verifyArcadeSite(rpc, evaluate, base) {
  async function ready(condition) {
    for (let i = 0; i < 150; i++) {
      try {
        if (await evaluate(condition)) return;
      } catch {}
      await wait(100);
    }
    throw Error("Timed out waiting for " + condition);
  }
  const url = new URL(base);
  await rpc("Page.navigate", { url: url.href });
  await ready(
    'document.readyState==="complete" && typeof catalog!=="undefined"',
  );
  assert(await evaluate('!performance.getEntriesByType("resource").some(r=>r.name.includes("/turntables/"))'),
    "Opening the site downloaded the model rotations before interaction");
  assert(
    await evaluate(`(async () => {
    let seen = 0;
    for (const button of byId("classes").children) {
      button.click();
      for (const model of byId("car-strip").children) {
        model.click();
        for (const view of document.querySelectorAll("[data-view]")) {
          view.click();
          const img = byId("car-img");
          img.loading = "eager";
          await img.decode();
          if (!img.naturalWidth || !img.alt.includes(byId("car-name").textContent)) return false;
          seen++;
        }
      }
    }
    return seen === 90;
  })()`),
    "Garage selection and photography",
  );
  assert(await evaluate(`(async()=>{
    const sample=document.createElement("canvas"); sample.width=40; sample.height=18;
    const ctx=sample.getContext("2d",{willReadFrequently:true});
    const arrow=()=>turntable.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
    for(let id=0;id<30;id++){
      selectCar(id); modelAngle("front"); const poses=new Set();
      for(let i=0;i<24;i++){
        arrow();
        if(view) await byId("car-img").decode();
        else {await rotationSheet.decode();showRotation();}
        if(rotationIndex!==(i+1)%24 || turntable.getAttribute("aria-valuenow")!==String(rotationIndex*15))return false;
        const image=view?byId("car-img"):rotation;
        if(!view && (rotation.hidden || rotationSheet.naturalWidth!==rotation.width*6 || rotationSheet.naturalHeight!==rotation.height*4))return false;
        ctx.drawImage(image,0,0,40,18);
        let hash=0;for(const pixel of ctx.getImageData(0,0,40,18).data)hash=Math.imul(hash,31)+pixel|0;
        poses.add(hash);
      }
      if(poses.size!==24)return false;
    }
    return true;
  })()`), "Rotating all 30 models with the keyboard");
  const handle = await evaluate(`(()=>{turntable.scrollIntoView({block:"center",behavior:"instant"});
    const r=turntable.getBoundingClientRect();return {x:r.x+r.width*.4,y:r.y+r.height*.5,w:r.width};})()`);
  await rpc("Input.dispatchMouseEvent", { type:"mousePressed", x:handle.x, y:handle.y, button:"left", clickCount:1 });
  await rpc("Input.dispatchMouseEvent", { type:"mouseMoved", x:handle.x+handle.w*.27, y:handle.y, buttons:1 });
  await rpc("Input.dispatchMouseEvent", { type:"mouseReleased", x:handle.x+handle.w*.27, y:handle.y, button:"left" });
  await ready("rotationIndex>0 && !turnDrag && !rotation.hidden");
  assert(
    await evaluate(`(async () => {
    const selector=byId("track"), image=byId("course-photo");
    image.loading="eager";
    if (selector.length!==20) return false;
    for (let i=0; i<20; i++) {
      selector.value=i;
      selector.dispatchEvent(new Event("change"));
      await image.decode();
      for (const [j,button] of cutButtons.entries()) {
        button.click();
        const cut=catalog.tracks[i].cuts[j];
        if(!button.textContent || !cut.metres || !image.naturalWidth ||
          byId("cut-detail").textContent.indexOf(cut.metres+" m shorter")<0 ||
          button.getAttribute("aria-pressed")!=="true" || branchLines[j].getTotalLength()<1) return false;
      }
    }
    for (const button of document.querySelectorAll("[data-damage]")) {
      button.click(); byId("damage-img").loading="eager"; await byId("damage-img").decode();
    }
    for (let i=0; i<7; i++) {
      const paint=byId("paint-sample"),photo=byId("paint-img");
      paint.selectedIndex=i;paint.dispatchEvent(new Event("change"));
      photo.loading="eager";await photo.decode();
      if(!byId("paint-unlock").textContent.includes(paint.value)) return false;
    }
    return true;
  })()`),
    "Course atlas, damage and paint booth",
  );
  await evaluate('byId("watch").click(); byId("film").load()');
  await ready(
    'byId("reel").open && byId("film").readyState>=1 && byId("film").duration>10',
  );
  await evaluate('byId("close-reel").click(); byId("embed-start").click()');
  await ready(
    'byId("play-frame")?.contentWindow.eval(\'typeof startRace==="function" && screen==="setup"\')',
  );
  await evaluate('byId("play-frame").contentWindow.eval("startRace()")');
  assert(
    await evaluate(
      'byId("play-frame").contentWindow.eval(\'screen==="race" && vehicles.length===8\')',
    ),
  );
  await evaluate('byId("stop-game").click()');
  assert(
    await evaluate(
      '!byId("play-frame") && document.activeElement===byId("embed-start")',
    ),
  );
  await evaluate(
    'byId("track").value="18";byId("track").dispatchEvent(new Event("change"));byId("launch").click()',
  );
  await ready(
    'screen==="setup" && typeof prefs!=="undefined" && prefs.track===18 && prefs.car===29',
  );
  await rpc("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await rpc("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await ready(
    'screen==="race" && routeId===18 && pl.id===29 && vehicles.length===8',
  );
  for (const [width, height] of [
    [320, 690],
    [390, 844],
    [844, 390],
  ]) {
    await rpc("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await rpc("Page.navigate", { url: url.href });
    await ready(
      'typeof catalog!=="undefined" && document.readyState==="complete"',
    );
    assert(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      "Overflow at " + width,
    );
    if (width === 390) {
      await rpc("Emulation.setTouchEmulationEnabled", { enabled:true, maxTouchPoints:5 });
      const p = await evaluate(`(()=>{turntable.scrollIntoView({block:"center",behavior:"instant"});
        const r=turntable.getBoundingClientRect();return {x:r.x+r.width*.3,y:r.y+r.height*.55};})()`);
      for (const [type,dx] of [["touchStart",0],["touchMove",70],["touchEnd",70]])
        await rpc("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x:p.x+dx,y:p.y,id:1}]});
      await ready("rotationIndex>0 && !turnDrag");
      assert(await evaluate("getComputedStyle(turntable).touchAction.includes('pan-y')"), "Vertical scrolling in showroom");
      await rpc("Emulation.setTouchEmulationEnabled", { enabled:false });
    }
  }
  await rpc("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await evaluate('byId("track").scrollIntoView()');
  await ready(
    'reduced.matches && getComputedStyle(byId("racer")).display==="none"',
  );
  const offlineGame =
    await evaluate(`(async()=>{const link=document.querySelector("[download]");
    const response=await fetch(link.href);const html=await response.text();
    return response.ok && html.includes("function startRace(") && link.download.endsWith(".html");
  })()`);
  assert(offlineGame, "Standalone game download");
  console.log(
    "Verified 720 rotation views, 90 showroom photos, mouse and touch dragging, 40 shortcuts, seven liveries, video, embedded and configured races, three phone layouts and the offline download at " +
      url.href,
  );
}
