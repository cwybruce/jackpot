// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and complete.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|complete (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resetWorld, stepWorld, EVENT_BUSTED, EVENT_COMPLETE, EVENT_MISSION } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  window.__shotInfo = {
    shot: name,
    screen: scene.screen,
    complete: state.complete,
    busted: state.busted,
    mission: state.mission,
    take: state.take,
    wanted: state.wanted,
  };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(window);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetWorld(state);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Four jobs, one take: $7,820.');
  }

  function endRun(complete) {
    screen = complete ? SCREEN_COMPLETE : SCREEN_OVER;
    if (state.take > best) {
      best = state.take;
      saveBest(best);
    }
    if (complete) audio.complete();
    else audio.busted();
    announce(complete ? `Jackpot. Take $${state.take}.` : `Busted. Take $${state.take}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      stepWorld(state, { up: false, down: false, left: false, right: false }, 0, STEP);
      return;
    }
    const events = stepWorld(state, input.held, actions, STEP);
    if (events & EVENT_MISSION) {
      audio.mission();
      announce(`${state.take > 0 ? `Take $${state.take}. ` : ''}Next job.`);
    }
    if (events & EVENT_COMPLETE) endRun(true);
    else if (events & EVENT_BUSTED) endRun(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const car = state.player.onFoot ? null : state.cars.find((c) => c.id === state.player.carId);
    audio.engine(car ? Math.abs(car.speed) / 560 : 0, !!car && screen === SCREEN_PLAY);
    audio.siren(state.wanted, state.time);
    renderer.draw(state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Jackpot. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
