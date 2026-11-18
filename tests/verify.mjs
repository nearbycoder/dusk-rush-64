import { verifyRaceFeedback } from "./race-feedback.mjs";
import { verifyTouch } from "./touch.mjs";
import { raceConditions } from "./race-conditions.mjs";
import { auditCourse } from "./world-audit.mjs";
import { verifyCameraAndContacts } from "./camera.mjs";
import { verifyCollisions } from "./collisions.mjs";
// Run with Node 22+ and Chrome. CHROME may point to a Chromium executable.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("..", import.meta.url)),
  profile = await mkdtemp(path.join(tmpdir(), "rush64-"));
const chrome =
  process.env.CHROME ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
assert(chrome, "Set CHROME to a Chromium executable");
const page = pathToFileURL(path.join(root, "docs", "play", "index.html")).href,
  proc = spawn(
    chrome,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--window-size=1440,900",
      "--user-data-dir=" + profile,
      page,
    ],
    { stdio: "ignore" },
  );
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let ws,
  seq = 0,
  loadComplete,
  waiting = new Map(),
  errors = [],
  captures = 0;
async function rpc(method, params = {}) {
  let id = ++seq,
    p = new Promise((resolve) => waiting.set(id, resolve));
  ws.send(JSON.stringify({ id, method, params }));
  let reply = await p;
  waiting.delete(id);
  assert(!reply.error, JSON.stringify(reply.error));
  return reply.result;
}
async function evalJS(expression) {
  let r = await rpc("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  assert(!r.exceptionDetails, r.exceptionDetails?.exception?.description);
  return r.result.value;
}
async function shot(name) {
  await evalJS("renderWorld();drawUI();gl.finish()");
  assert.equal(await evalJS("gl.getError()"),0,"WebGL error in "+name);
  let out = await rpc("Page.captureScreenshot", { format: "png" }),
    dest = path.join(root, "captures", name + ".png");
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(out.data, "base64"));
  captures++;
}
async function reload() {
  const loaded = new Promise((resolve) => (loadComplete = resolve));
  await rpc("Page.reload");
  await loaded;
  await evalJS("testMode=true");
}
async function verifyKeyboardMenus() {
  await evalJS('testMode=true; change("title"); drawUI(); document.activeElement.blur()');
  const key=async(code,key,modifiers=0)=>{
    const windowsVirtualKeyCode={Tab:9,Enter:13,Escape:27}[code];
    for(const type of ["keyDown","keyUp"])
      await rpc("Input.dispatchKeyEvent",{type,code,key,modifiers,windowsVirtualKeyCode,
        text: type==="keyDown" && code==="Enter" ? "\r" : undefined});
    await evalJS("drawUI()");
  };
  await key("Tab","Tab");
  const first=await evalJS("document.activeElement.dataset.action");
  assert(first,"Tab did not focus a real menu control");
  await key("Tab","Tab");
  assert.notEqual(await evalJS("document.activeElement.dataset.action"),first);
  await key("Tab","Tab",8);
  assert.equal(await evalJS("document.activeElement.dataset.action"),first,"Shift-Tab did not go back");
  await evalJS(`startRace();pause();drawUI();accessMenu.querySelector('[data-action="action0"]').focus()`);
  await key("Enter","Enter");
  assert.equal(await evalJS("screen"),"race");
  await key("Escape","Escape"); assert.equal(await evalJS("screen"),"pause");
}
async function verifyDisplayRecovery() {
  const signature=`JSON.stringify([routeId,elapsed,pl.s,pl.x,pl.gate,pl.lap,pl.damage,cam,score,
    prefs.cups,vehicles.map(v=>[v.id,v.progress,v.cut])])`;
  await evalJS(`Object.assign(prefs,structuredClone(defaults),{mode:1,cup:1});
    startRace();countdown=0;for(let i=0;i<720;i++)step(dt,true);cam=2;renderWorld();drawUI();`);
  const previous=await evalJS(signature);
  await evalJS('window.testLoss=gl.getExtension("WEBGL_lose_context");testLoss.loseContext()');
  for(let n=0;n<24 && !await evalJS("graphicsLost");n++)await delay(25);
  assert(await evalJS('graphicsLost && err.querySelector("button") && accessMenu.inert'));
  const loaded=new Promise(resolve=>loadComplete=resolve);
  await evalJS('testLoss.restoreContext()');
  let timeout;
  try {
    await Promise.race([loaded,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error("Graphics restore timed out")),12000))]);
  } finally {clearTimeout(timeout)}
  await evalJS("testMode=true;renderWorld();drawUI()");
  assert.equal(await evalJS(signature),previous,"Context restoration changed the running race");
  assert(await evalJS('screen==="pause" && !graphicsLost && gl.getError()===gl.NO_ERROR'));
  await evalJS("pause();step(dt,true)");
  assert.equal(await evalJS("screen"),"race");
  console.log("Lost and restored WebGL2 during a cup race with its station, opponents and timing intact.");
}
async function tests() {
  let port;
  for (let i = 0; i < 160 && !port; i++) {
    try {
      port = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
    } catch {
      await delay(50);
    }
  }
  assert(port);
  let tab = (
    await (await fetch("http://localhost:" + port + "/json/list")).json()
  ).find((t) => t.url === page);
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    let msg = JSON.parse(e.data);
    if (msg.method === "Page.loadEventFired") loadComplete?.();
    if (msg.id) waiting.get(msg.id)?.(msg);
    if (msg.method === "Log.entryAdded" && /WebGL.*(?:INVALID_|OUT_OF_MEMORY)/i.test(msg.params.entry.text)) errors.push(msg.params.entry.text);
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(msg.params.exceptionDetails.exception?.description);
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    )
      errors.push(msg.params.args);
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Log.enable");
  await reload();
  if (process.argv.includes("--touch")) {
    await verifyTouch(rpc, evalJS);
    assert.deepEqual(errors, []);
    return;
  }
  if (process.argv.includes("--feedback")) {
    await verifyDisplayRecovery();
    await verifyKeyboardMenus();
    assert(await evalJS("(" + verifyRaceFeedback.toString() + ")()"));
    assert.deepEqual(errors, []);
    console.log("Race feedback, scoring, time trials, liveries and audio passed.");
    return;
  }
  await shot("title");
  await evalJS(
    "keydown({code:'Enter',preventDefault(){}});drawUI();activate();testMode=true",
  );
  assert.equal(await evalJS("screen"), "race");
  await evalJS("for(let k=0;k<288;k++)step(dt,true)");
  await shot("active-race");
  for (let i = 0; i < 20; i++) {
    await evalJS("change('tracks');transition=0;prefs.track=" + i);
    await shot("tracks/" + String(i + 1).padStart(2, "0"));
  }
  for (let i = 0; i < 30; i++) {
    await evalJS(
      "change('garage');transition=0;prefs.car=" +
        i +
        ";prefs.paint=" +
        (i % 8) +
        ";clock=1",
    );
    await shot("cars/" + String(i + 1).padStart(2, "0"));
  }
  console.log("Captured every track preview and vehicle selection.");
  let topology = await evalJS(`(()=>{
    const signatures=new Set;
    for(let id=0;id<cars.length;id++){
      let whole=[],part={bit:32,vertices:[]};
      carMesh(whole,id,paints[0],undefined,0,false,part);
      let hash=2166136261,wheels=new Set;
      for(let i=0;i<whole.length;i+=9){
        for(let c=0;c<3;c++)hash=Math.imul(hash^Math.round(whole[i+c]*10000),16777619);
        if(whole[i+8]>=32)wheels.add(Math.floor(whole[i+8]/32));
      }
      if(!whole.every(Number.isFinite)||wheels.size!==4||!part.vertices.length||!part.vertices.every(Number.isFinite))return false;
      signatures.add(hash);
      prefs.car=id;orbit=.65;renderWorld();orbit=-2.43;
    }
    return signatures.size===30&&gl.getError()===gl.NO_ERROR;
  })()`);
  assert(
    topology,
    "Distinct body geometry and four separately rigged wheel groups per vehicle",
  );
  const pointer = await evalJS(
    "({x:innerWidth*.75,y:innerHeight*.47,yaw:orbit})",
  );
  await rpc("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    buttons: 1,
    clickCount: 1,
    x: pointer.x,
    y: pointer.y,
  });
  await rpc("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    buttons: 1,
    x: pointer.x + 70,
    y: pointer.y,
  });
  await rpc("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    buttons: 0,
    clickCount: 1,
    x: pointer.x + 70,
    y: pointer.y,
  });
  assert(
    await evalJS(
      "Math.abs(orbit-(" +
        JSON.stringify(pointer.yaw) +
        "))>.5&&orbitDrag===null",
    ),
  );
  console.log(
    "Verified roster geometry, wheel rigs, detachable wheel meshes and showroom drag.",
  );
  let lineup = await evalJS(`(()=>{
    let plate=document.createElement('canvas');plate.width=1440;plate.height=752;
    const g=plate.getContext('2d');g.fillStyle='#191c1e';g.fillRect(0,0,1440,752);
    g.fillStyle='#f6f1df';g.font='italic 900 32px Arial';g.fillText("DUSK RUSH ’64",25,44);
    g.fillStyle='#c5ed48';g.font='600 13px monospace';g.fillText('VEHICLE SHOWROOM',1218,42);
    g.imageSmoothingEnabled=false;
    const selections=[[12,0,-2.34],[6,2,-2.48],[3,5,.71],[20,3,-2.31],[25,6,-2.42],[27,4,-2.52]];
    selections.forEach(([id,paint,yaw],i)=>{
      prefs.car=id;prefs.paint=paint;orbit=yaw;renderWorld();gl.finish();
      const x=15+(i%3)*475,y=66+Math.floor(i/3)*337;
      g.drawImage(world,world.width*.369,world.height*.195,world.width*.62,world.height*.61,x,y,465,267);
      g.fillStyle='#2b2e30';g.fillRect(x,y+267,465,55);
      g.fillStyle='#d2fb47';g.font='600 11px monospace';g.fillText(groups[Math.floor(id/6)].toUpperCase(),x+14,y+282);
      g.fillStyle='#f6f1df';g.font='italic 800 23px Arial';g.fillText(names[id],x+13,y+309);
    });
    return plate.toDataURL('image/png').split(',')[1];
  })()`);
  await writeFile(
    path.join(root, "captures", "vehicle-lineup.png"),
    Buffer.from(lineup, "base64"),
  );
  captures++;

  let report = await evalJS(
    `(()=>{let log=[];Object.assign(prefs,structuredClone(defaults));for(let id=0;id<20;id++){prefs.track=id;startRace();let started=vehicles.every(a=>!firstWall(hull(a),hull(a))&&a.s>=0&&Math.abs(a.x)<rte.width&&vehicles.every(b=>a===b||Math.abs(a.x-b.x)>(cars[a.id][1]+cars[b.id][1])/2||Math.abs(a.s-b.s)>(cars[a.id][0]+cars[b.id][0])/2));let ordered=rte.gates.every((s,i)=>i===0||s>rte.gates[i-1]),cuts=new Set(),prev=vehicles.map(v=>v.gate),safe=true;for(let k=0;k<24000&&vehicles.some(v=>!v.finish);k++){if(screen==='results')screen='race';step(dt,true);for(let v of vehicles){if(v.cut>=0)cuts.add(v.cut);if(!v.finish&&!v.recovery){const g=hull(v);if(firstWall(g,g))safe=false;}if(v.gate>prev[v.slot]+1)ordered=false;prev[v.slot]=v.gate;if(![v.s,v.x,v.air,v.safe,v.safeX].every(Number.isFinite)||v.safe<0||v.safe>rte.len)safe=false}}log.push({course:rte.t[0],started,ordered,safe,cuts:cuts.size,finished:vehicles.filter(v=>v.finish).length})}return log})()`,
  );
  for (let r of report)
    assert(
      r.started && r.ordered && r.safe && r.cuts === 2 && r.finished === 8,
      JSON.stringify(r),
    );
  console.log(
    "All eight racers finished all 20 routes, validated both shortcuts, starting grids, safe stations and ordered checkpoints.",
  );
  const collisions = await evalJS("(" + verifyCollisions.toString() + ")()");
  console.log(
    "Passed " + collisions.length + " targeted world collision checks.",
  );
  const cameraChecks = await evalJS(
    "(" + verifyCameraAndContacts.toString() + ")()",
  );
  console.log(
    "Passed " +
      cameraChecks.length +
      " camera, vehicle hull and contact checks.",
  );
  const totals = { views: 0, bodyProbes: 0, portals: 0 };
  for (let track = 0; track < 20; track++) {
    const audit = await evalJS(
      "(" + auditCourse.toString() + ")(" + track + ")",
    );
    assert.deepEqual(audit.fails, [], JSON.stringify(audit));
    for (const key of Object.keys(totals)) totals[key] += audit[key];
  }
  console.log(
    "Checked " +
      totals.views +
      " camera views, " +
      totals.bodyProbes +
      " moving car poses and " +
      totals.portals +
      " shortcut transitions against rendered WebGL geometry.",
  );
  let races = 0;
  for (let track = 0; track < 20; track++) {
    const rounds = await evalJS(
      "(" + raceConditions.toString() + ")(" + track + ")",
    );
    races += rounds.length;
  }
  console.log(
    "All eight racers finished " +
      races +
      " additional races across all difficulty and damage settings, with bounded camera movement.",
  );
  let carChecks = await evalJS(
    `(()=>{prefs.mode=4;prefs.track=0;let bad=[];for(let id=0;id<30;id++){prefs.car=id;startRace();keys.add('KeyW');for(let k=0;k<80;k++)step(dt);let fast=pl.speed>12;keys.add('KeyD');let x=pl.x;for(let k=0;k<20;k++)step(dt);let steer=pl.x>x+.1;keys.clear();keys.add('KeyS');let before=pl.speed;for(let k=0;k<25;k++)step(dt);let brake=pl.speed<before-3;keys.clear();pl.s=rte.jumps[0]-.2;pl.x=0;pl.cut=-1;pl.speed=34;step(dt);let jumped=pl.air>1;for(let k=0;k<220;k++)step(dt,true);pl.cut=-1;pl.x=rte.width-1;pl.speed=40;pl.side=17;pl.inv=pl.stun=0;drive(pl,{gas:1,brake:0,steer:1,hand:false,boost:false},dt);let damage=pl.damage.some(d=>d>0);let meshData=[];reset();carMesh(meshData,id,pl.colour,[1,1,1,1,1],63);let bounded=meshData.every(Number.isFinite)&&meshData.every((v,i)=>i%9>2||Math.abs(v)<4);let g=pl.gate;manual();for(let k=0;k<70;k++)step(dt);if(![fast,steer,brake,jumped,damage,bounded,pl.recovery<=0,pl.penalty>=3,pl.gate===g,pl.lost===0].every(Boolean))bad.push({id,fast,steer,brake,jumped,damage,bounded})}return bad})()`,
  );
  assert.deepEqual(carChecks, []);
  console.log(
    "All 30 cars passed acceleration, braking, steering, launch, barrier impact, bounded mesh and recovery checks.",
  );
  await evalJS(
    "Object.assign(prefs,structuredClone(defaults));prefs.mode=1;startRace();for(let i=0;i<20000&&screen==='race';i++)step(dt,true);",
  );
  assert.equal(await evalJS("cupState().round"), 1);
  await reload();
  assert.equal(await evalJS("cupState().round"), 1);
  for (let i = 1; i < 4; i++) {
    await evalJS(
      "startRace();for(let i=0;i<20000&&screen==='race';i++)step(dt,true)",
    );
    assert.equal(await evalJS("results.round"), i + 1);
  }
  await shot("cup-results");
  for (let cup = 1; cup < 5; cup++) {
    await evalJS("prefs.cup=" + cup);
    for (let round = 1; round <= 4; round++) {
      await evalJS(
        "startRace();for(let i=0;i<24000&&screen==='race';i++)step(dt,true)",
      );
      assert.equal(await evalJS("results.round"), round);
    }
    assert(await evalJS("prefs.medals[prefs.cup]>0&&cupState().round===0"));
  }
  console.log("Completed all five championship cups.");

  await evalJS(
    `prefs.mode=2;prefs.track=0;startRace();
      for(let i=0;i<18000&&screen==="race";i++){
        step(dt,true);clock+=dt;
        if(pl.lap>=2 && i%3===0){renderWorld();recordFinishFrame()}
      }`,
  );
  assert(await evalJS("results.best&&prefs.ghosts[0].length>200"));
  await shot("race-results");
  await evalJS('beginReplay(); filmPaused=true; filmCursor=3.8; drawUI()');
  assert.equal(await evalJS("screen"),"replay");
  await shot("finish-replay");
  await reload();
  await evalJS("startRace();for(let i=0;i<380;i++)step(dt,true);renderWorld()");
  assert(
    await evalJS(
      "ghostPlayback.length>200&&ghostPlayback[0][1]!==ghostPlayback[200][1]",
    ),
  );
  await shot("ghost-playback");
  console.log(
    "Championship cup, mid-cup reload, time attack record and ghost playback passed.",
  );
  await evalJS(
    "prefs.mode=4;prefs.track=6;prefs.car=29;startRace();for(let i=0;i<10000&&pl.air<8;i++)step(dt,true);notice('SKYLINE LAUNCH')",
  );
  assert(await evalJS("pl.air>=8"));
  await shot("major-jump");
  await evalJS(
    "prefs.track=1;prefs.car=12;prefs.mode=3;startRace();countdown=0;pl.s=props[0].s+Math.sin(elapsed*.14+props[0].s)*6-3.5-cars[pl.id][0]/2-.4;pl.x=props[0].x;pl.speed=39;step(dt);step(dt)",
  );
  assert(await evalJS("pl.damage[0]>.5"));
  await shot("body-deformation");
  await evalJS('pause();openPhoto();photoYaw=.69;photoElevation=.26;photoDistance=5.3;drawUI()');
  await shot("photo-mode");
  await evalJS("leavePhoto();pause()");
  await evalJS(
    "pl.inv=pl.stun=0;pl.s=props[0].s+Math.sin(elapsed*.14+props[0].s)*6-3.5-cars[pl.id][0]/2-.4;pl.speed=65;step(dt);step(dt);for(let i=0;i<9;i++)step(dt)",
  );
  assert(await evalJS("pl.recovery>0&&fx.length>0&&bits.length>0"));
  await shot("full-wreck");
  let stress = await evalJS(
    `(()=>{prefs.mode=4;prefs.track=1;startRace();let seed=8431,random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296,ok=true;for(let i=0;i<21600;i++){if(i%67===0){keys.clear();keys.add('KeyW');if(random()<.75)keys.add('ShiftLeft');if(random()<.72)keys.add('Space');if(random()<.5)keys.add('KeyS');keys.add(random()<.5?'KeyA':'KeyD');cam=(cam+1)%3}if(i%1801===1800)manual();if(i%5400===5399)startRace();step(dt);if(i%400===0){renderWorld();drawUI();if(gl.getError()!==gl.NO_ERROR)ok=false}if(!pl.recovery){let g=hull(pl);if(firstWall(g,g))ok=false}ok=ok&&[pl.speed,pl.s,pl.roll,pl.x,pl.air].every(Number.isFinite)&&fx.length<=particleCap&&bits.length<=28}return ok})()`,
  );
  assert(stress);
  console.log(
    "Six simulated minutes of simultaneous inputs, collisions, recoveries, camera changes and restarts passed.",
  );
  await evalJS(
    `localStorage.setItem("dusk-rush64-v1", JSON.stringify({...structuredClone(defaults),car:24,medals:{0:35},cups:{1:{round:2,points:17}},records:{"2-0":84},ghosts:{0:[[1,10,0,0,-1,0]]}}));localStorage.removeItem(key)`,
  );
  await reload();
  assert(
    await evalJS(
      'prefs.car===24&&prefs.medals[0]===35&&prefs.cups[1].points===17&&!prefs.records["2-0"]&&!prefs.ghosts[0]&&JSON.parse(localStorage.getItem("dusk-rush64-v1")).records["2-0"]===84',
    ),
  );
  await evalJS("localStorage.setItem(key,'{broken')");
  await reload();
  assert.equal(await evalJS("prefs.mode"), 0);
  assert.equal(await evalJS("prefs.damage"), 1);
  await evalJS("prefs.aspect=true;resize();prefs.reduced=true;save()");
  assert(Math.abs((await evalJS("winW/winH")) - 4 / 3) < 0.001);
  await reload();
  assert(await evalJS("prefs.aspect&&prefs.reduced"));
  await rpc("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await evalJS("prefs.aspect=false;prefs.mode=4;startRace();drawUI()");
  const points = await evalJS(
    "['KeyW','ArrowLeft','ShiftLeft'].map((key,id)=>{const b=buttons.find(b=>b.id===key),r=ui.getBoundingClientRect();return {x:r.left+(b.x+b.w/2)*S,y:r.top+(b.y+b.h/2)*S,id:id+1}})",
  );
  await rpc("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  assert(
    await evalJS("control().gas===1&&control().steer===-1&&control().boost"),
  );
  await rpc("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert(await evalJS("touches.size===0"));
  assert(
    await evalJS(
      `(()=>{let b=Array.from({length:17},()=>({value:0,pressed:false}));b[7]={value:.73,pressed:true};b[4]={value:1,pressed:true};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{axes:[.44],buttons:b}]});gamepad();let u=control();delete navigator.getGamepads;return u.steer===.44&&u.gas===.73&&u.boost})()`,
    ),
  );
  await evalJS("keys.add('KeyW');window.dispatchEvent(new Event('blur'))");
  assert(await evalJS("screen==='pause'&&keys.size===0&&touches.size===0"));
  await verifyTouch(rpc, evalJS);
  await verifyDisplayRecovery();
  await verifyKeyboardMenus();
  assert(await evalJS("(" + verifyRaceFeedback.toString() + ")()"));
  await rpc("Page.addScriptToEvaluateOnNewDocument", {
    source:
      "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError')}})",
  });
  await reload();
  assert(await evalJS("prefs.sound===false&&prefs.mode===0"));
  await evalJS("startRace();save();renderWorld()");
  console.log(
    "Three-touch controls, analogue gamepad mapping, focus loss and unavailable storage passed.",
  );
  assert.deepEqual(errors, []);
  console.log(
    captures + " PNG captures. No browser exceptions or console errors.",
  );
}
try {
  await tests();
} finally {
  ws?.close();
  proc.kill();
  await delay(250);
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
