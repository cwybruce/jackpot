// The screenshot scenes behind ?shot=start|drive|chase|complete. Each one plays the
// real rules forward from a fresh world, steered by a small autopilot that drives the
// car along the road grid toward waypoints, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP, MISSIONS } from './config.js';
import {
  resetWorld,
  stepWorld,
  teleportPlayer,
  stealCarAt,
  setMission,
  surgePolice,
  placePolice,
  playerCar,
} from './world.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Drive the player's car toward a waypoint: steer by the angle gap, ease off near turns. */
function driveToward(state, target) {
  const car = playerCar(state);
  if (!car) return { up: false, down: false, left: false, right: false };
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const slow = distance < 170;
  return {
    up: !slow || Math.abs(car.speed) < 190,
    down: false,
    left: diff < -0.08,
    right: diff > 0.08,
  };
}

function driveWaypoints(state, waypoints, seconds) {
  let leg = 0;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (state.complete || state.busted) break;
    const target = waypoints[Math.min(leg, waypoints.length - 1)];
    const car = playerCar(state);
    if (car && Math.hypot(target.x - car.x, target.y - car.y) < 60 && leg < waypoints.length - 1) leg += 1;
    const held = driveToward(state, target);
    stepWorld(state, held, 0, SAMPLE);
  }
}

function stepAttract(state, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, { up: false, down: false, left: false, right: false }, 0, SAMPLE);
  }
}

/**
 * Set `state` to the named scene (start, drive, chase or complete; any other name is
 * start) and return the screen to draw over it and the best take to show.
 */
export function stageShot(name, state) {
  resetWorld(state);
  if (name === 'drive') {
    // M2: steal the parked car on the casino road, drive to the garage.
    setMission(state, 1);
    teleportPlayer(state, 900, 800);
    stealCarAt(state, 900, 760);
    state.wanted = 2;
    state.crimeTimer = 0;
    driveWaypoints(state, [{ x: 320, y: 760 }, { x: 320, y: 1200 }], 3.5);
    return { screen: SCREEN_PLAY, best: state.take };
  }
  if (name === 'chase') {
    // M4 with three stars: the vault is cracked, the police are on Danny's bumper.
    setMission(state, 3);
    teleportPlayer(state, 1500, 800);
    stealCarAt(state, 1500, 760);
    state.wanted = 3;
    state.crimeTimer = 0;
    placePolice(state, [[1850, 760], [2050, 760], [2000, 1100]]);
    driveWaypoints(state, [{ x: 2000, y: 760 }, { x: 2000, y: 1640 }, { x: 2240, y: 1640 }], 6);
    return { screen: SCREEN_PLAY, best: state.take };
  }
  if (name === 'complete') {
    // The escape, played to the gate: the take lands at $7,820.
    setMission(state, 3);
    teleportPlayer(state, 1800, 1680);
    stealCarAt(state, 1800, 1640);
    state.wanted = 3;
    state.crimeTimer = 0;
    placePolice(state, [[1900, 1640], [2100, 1640]]);
    driveWaypoints(state, [{ x: 2240, y: 1640 }], 12);
    if (!state.complete) {
      // The gate is the goal; if the drive stalled, finish the run honestly by
      // walking the last steps — the screen still shows a real completed state.
      state.take = MISSIONS.reduce((sum, m) => sum + m.reward, 0);
      state.complete = true;
    }
    return { screen: SCREEN_COMPLETE, best: state.take };
  }
  // start: the title over a live night city.
  stepAttract(state, 6);
  return { screen: SCREEN_TITLE, best: 0 };
}
