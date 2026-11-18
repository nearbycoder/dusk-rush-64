import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";

// Drive the production animation loop in real time. The accelerated suite covers
// input devices separately. This pass exercises graphics state across races.
export async function verifyEndurance(evaluate, minutes) {
  const started = Date.now();
  let round = 0;
  let totalFrames = 0;
  let slowFrames = 0;
  await evaluate(`testMode=false;
    window.raceFrames=0;window.slowFrames=0;window.previousDraw=0;
    const originalRender=renderWorld;
    renderWorld=()=>{
      const now=performance.now();
      if(previousDraw && now-previousDraw>50)slowFrames++;
      previousDraw=now;raceFrames++;originalRender();
    };
    control=()=>ai(pl);`);
  do {
    const car = (round * 7) % 30;
    const track = round % 20;
    const mode = [0, 2, 3][round % 3];
    await evaluate(`prefs.car=${car};prefs.track=${track};prefs.mode=${mode};
      prefs.difficulty=${(round + Math.floor(round / 20)) % 3};prefs.damage=${round % 3};
      prefs.livery=${round % 2};startRace();raceFrames=slowFrames=previousDraw=0;`);
    const raceStart = Date.now();
    let state;
    let previous = -1;
    do {
      await wait(3000);
      state = await evaluate(`(() => {
        if (screen==="race") cam=Math.floor(elapsed/15)%3;
        return {screen,frames:raceFrames,slow:slowFrames,error:gl.getError(),
          finite:[pl.speed,pl.x,pl.air,pl.s,...raceView.eye].every(Number.isFinite)};
      })()`);
      assert(
        state.finite && state.frames > previous && state.error === 0,
        JSON.stringify(state),
      );
      assert(
        Date.now() - raceStart < 600000,
        "Race timeout on course " + (track + 1),
      );
      previous = state.frames;
    } while (state.screen === "race");
    assert.equal(state.screen, "results");
    assert(await evaluate("filmCount>3 && Number.isFinite(results.time)"));
    await evaluate(
      "beginReplay();filmPaused=true;filmCursor=.75;renderWorld();drawUI();",
    );
    assert(await evaluate('screen==="replay" && gl.getError()===gl.NO_ERROR'));
    await evaluate('change("results")');
    totalFrames += state.frames;
    slowFrames += state.slow;
    console.log(
      `Course ${track + 1}, car ${car + 1}, ${state.frames} frames, ${state.slow} over 50 ms`,
    );
    round++;
  } while (Date.now() - started < minutes * 60000);
  console.log(
    `${round} real-time finishes, ${totalFrames} frames, ${slowFrames} over 50 ms.`,
  );
}
