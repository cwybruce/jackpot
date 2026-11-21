// The world: Port Vane at night. One state object holds the player, every car and
// pedestrian, the police, the wanted level and the mission. step() advances it in fixed
// steps; the renderer only reads it, and shots.js steers it with scripted inputs.
import {
  WORLD,
  H_ROADS,
  V_ROADS,
  ROAD_HALF,
  PLAYER,
  CAR,
  POLICE,
  MISSIONS,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PARKED_CARS,
  CAR_COLORS,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION = 1;
export const EVENT_COMPLETE = 2;
export const EVENT_BUSTED = 4;
export const EVENT_CRIME = 8;

const TAU = Math.PI * 2;

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function onRoad(x, y) {
  for (const ry of H_ROADS) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  for (const rx of V_ROADS) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  return false;
}

function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x: Math.max(60, Math.min(WORLD.width - 60, x)), y: ry };
    }
  }
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y: Math.max(60, Math.min(WORLD.height - 60, y)) };
    }
  }
  return best;
}

/** Buildings fill the blocks between roads; the casino is the fixed gold block. */
function buildCity(rng) {
  const buildings = [];
  const xs = [0, ...V_ROADS, WORLD.width];
  const ys = [0, ...H_ROADS, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_HALF + 18;
      const x1 = xs[bi + 1] - ROAD_HALF - 18;
      const y0 = ys[bj] + ROAD_HALF + 18;
      const y1 = ys[bj + 1] - ROAD_HALF - 18;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const isCasinoBlock = bi === 2 && bj === 1;
      if (isCasinoBlock) {
        buildings.push({
          x: 960, y: 400, w: 400, h: 280,
          color: '#3a2c10', neon: true, name: 'THE GILDED PALM',
        });
        continue;
      }
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(90, Math.min(260, x1 - x0));
        const h = rng.range(80, Math.min(220, y1 - y0));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        buildings.push({
          x, y, w, h,
          color: rng.pick(['#1a2036', '#221a33', '#14261f', '#2a1a24', '#1f2438']),
          neon: false,
          name: '',
          seed: rng.int(0, 999999),
        });
      }
    }
  }
  return buildings;
}

function circleHitsBuilding(x, y, radius, buildings) {
  for (const b of buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

/** Move with a slide: try the full step, then each axis alone, else stay put. */
function moveWithSlide(pos, dx, dy, radius, buildings) {
  const nx = pos.x + dx;
  const ny = pos.y + dy;
  if (!circleHitsBuilding(nx, ny, radius, buildings)) {
    pos.x = nx;
    pos.y = ny;
    return;
  }
  if (!circleHitsBuilding(nx, pos.y, radius, buildings)) {
    pos.x = nx;
    return;
  }
  if (!circleHitsBuilding(pos.x, ny, radius, buildings)) {
    pos.y = ny;
  }
}

export function createWorld(rng) {
  const state = {
    rng,
    time: 0,
    buildings: buildCity(rng),
    player: {
      x: 1000, y: 860, angle: -Math.PI / 2, onFoot: true, carId: -1,
      health: PLAYER.health, punchCooldown: 0,
    },
    cars: [],
    peds: [],
    wanted: 0,
    crimeTimer: 0,
    mission: 0,
    missionProgress: 0,
    take: 0,
    complete: false,
    busted: false,
    policeSpawnTimer: 0,
    hint: '',
    hintTimer: 0,
    shake: 0,
  };

  // Traffic: cars cruising the road grid.
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const horizontal = rng.next() < 0.5;
    const road = horizontal ? rng.pick(H_ROADS) : rng.pick(V_ROADS);
    const along = rng.range(120, (horizontal ? WORLD.width : WORLD.height) - 120);
    state.cars.push({
      id: i,
      x: horizontal ? along : road,
      y: horizontal ? road : along,
      angle: horizontal ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: rng.range(120, 185),
      color: rng.pick(CAR_COLORS),
      traffic: true, parked: false, police: false,
      health: CAR.health, ramCooldown: 0, turnAt: null,
    });
  }
  // Parked cars to steal, sitting on the roads.
  const parkedSpots = [
    [900, 760, 0], [1500, 760, Math.PI], [600, 1200, 0],
    [1800, 1640, Math.PI], [320, 500, Math.PI / 2], [2000, 320, -Math.PI / 2],
  ];
  for (let i = 0; i < PARKED_CARS; i += 1) {
    const [x, y, angle] = parkedSpots[i];
    state.cars.push({
      id: TRAFFIC_CARS + i,
      x, y, angle, speed: 0,
      color: rng.pick(CAR_COLORS),
      traffic: false, parked: true, police: false,
      health: CAR.health, ramCooldown: 0, turnAt: null,
    });
  }
  // Pedestrians wandering the sidewalks.
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    const spot = nearestRoadPoint(rng.range(100, WORLD.width - 100), rng.range(100, WORLD.height - 100));
    const target = nearestRoadPoint(rng.range(100, WORLD.width - 100), rng.range(100, WORLD.height - 100));
    state.peds.push({
      x: spot.x + rng.range(-50, 50), y: spot.y + rng.range(-50, 50),
      tx: target.x, ty: target.y,
      speed: rng.range(38, 62),
      color: rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#e67e22']),
      down: 0,
    });
  }
  return state;
}

export function resetWorld(state) {
  const fresh = createWorld(state.rng);
  Object.keys(fresh).forEach((key) => { state[key] = fresh[key]; });
}

function nearestCar(state, x, y, maxDist, policeOk) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.police && !policeOk) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function addCrime(state, stars) {
  state.wanted = Math.min(5, state.wanted + stars);
  state.crimeTimer = 0;
  return EVENT_CRIME;
}

function spawnPolice(state, count, near) {
  let spawned = 0;
  for (let i = 0; i < count; i += 1) {
    const edge = state.rng.pick(H_ROADS.concat(V_ROADS));
    const horizontal = H_ROADS.includes(edge);
    const along = state.rng.range(120, (horizontal ? WORLD.width : WORLD.height) - 120);
    const x = horizontal ? along : edge;
    const y = horizontal ? edge : along;
    if (near && dist(x, y, near.x, near.y) < 500) continue;
    state.cars.push({
      id: 1000 + Math.floor(state.time * 60) + i,
      x, y,
      angle: angleTo(x, y, state.player.x, state.player.y),
      speed: POLICE.speed,
      color: '#e8ecf4',
      traffic: false, parked: false, police: true,
      health: CAR.health, ramCooldown: 0, turnAt: null,
      ox: state.rng.range(-70, 70), oy: state.rng.range(-70, 70),
    });
    spawned += 1;
  }
  return spawned;
}

function policeCount(state) {
  return state.cars.filter((c) => c.police).length;
}

function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.police) continue;
    if (car.parked) continue;
    if (!car.traffic) continue;
    // At a crossing, sometimes turn onto the other road.
    const cx = car.x;
    const cy = car.y;
    const nearCrossing = H_ROADS.some((ry) => Math.abs(cy - ry) < 14) && V_ROADS.some((rx) => Math.abs(cx - rx) < 14);
    if (nearCrossing && state.rng.next() < 0.012) {
      const horizontal = Math.abs(Math.cos(car.angle)) > 0.7;
      if (horizontal) {
        car.angle = state.rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.x = V_ROADS.reduce((a, b) => (Math.abs(b - cx) < Math.abs(a - cx) ? b : a));
      } else {
        car.angle = state.rng.next() < 0.5 ? 0 : Math.PI;
        car.y = H_ROADS.reduce((a, b) => (Math.abs(b - cy) < Math.abs(a - cy) ? b : a));
      }
    }
    // Do not rear-end the car ahead.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.parked) continue;
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 46 && side < 18) { blocked = true; break; }
    }
    if (blocked) continue;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 40) car.x = WORLD.width - 40;
    if (car.x > WORLD.width - 40) car.x = 40;
    if (car.y < 40) car.y = WORLD.height - 40;
    if (car.y > WORLD.height - 40) car.y = 40;
  }
}

function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      const target = nearestRoadPoint(
        state.rng.range(100, WORLD.width - 100),
        state.rng.range(100, WORLD.height - 100),
      );
      ped.tx = target.x + state.rng.range(-40, 40);
      ped.ty = target.y + state.rng.range(-40, 40);
      continue;
    }
    const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
  }
}

function stepPolice(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (!car.police) continue;
    const targetAngle = angleTo(car.x, car.y, player.x + (car.ox ?? 0), player.y + (car.oy ?? 0));
    const diff = normAngle(targetAngle - car.angle);
    car.angle += Math.max(-POLICE.turnRate * dt, Math.min(POLICE.turnRate * dt, diff));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    const d = dist(car.x, car.y, player.x, player.y);
    if (d < 34 && car.ramCooldown <= 0) {
      car.ramCooldown = POLICE.ramCooldown;
      state.shake = 0.35;
      if (player.onFoot) {
        state.busted = true;
        return EVENT_BUSTED;
      }
      const myCar = state.cars.find((c) => c.id === player.carId);
      if (myCar) {
        myCar.health -= POLICE.ramDamage;
        if (myCar.health <= 0) {
          myCar.health = 0;
          myCar.parked = true;
          player.onFoot = true;
          player.carId = -1;
          player.x = myCar.x + 40;
          player.y = myCar.y + 40;
          state.hint = 'Your ride is wrecked. Run!';
          state.hintTimer = 3;
        }
      }
    }
  }
  return EVENT_NONE;
}

function stepPlayer(state, held, actions, dt) {
  const player = state.player;
  let events = EVENT_NONE;
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);

  if (player.onFoot) {
    let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let my = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my);
      mx /= len;
      my /= len;
      player.angle = Math.atan2(my, mx);
      moveWithSlide(player, mx * PLAYER.walkSpeed * dt, my * PLAYER.walkSpeed * dt, PLAYER.radius, state.buildings);
    }
    if (actions & 4) {
      const car = nearestCar(state, player.x, player.y, 56, false);
      if (car) {
        player.onFoot = false;
        player.carId = car.id;
        car.traffic = false;
        car.parked = false;
        car.speed = 0;
        if (car.health <= 0) car.health = CAR.health;
        events |= addCrime(state, 2);
        state.hint = 'Car stolen! The law is coming.';
        state.hintTimer = 3;
      } else {
        state.hint = 'No car close enough to steal.';
        state.hintTimer = 2;
      }
    }
    if ((actions & 8) && player.punchCooldown <= 0) {
      player.punchCooldown = 0.45;
      let hit = null;
      let bestD = 48;
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        const d = dist(player.x, player.y, ped.x, ped.y);
        if (d < bestD) { bestD = d; hit = ped; }
      }
      if (hit) {
        hit.down = 3;
        events |= addCrime(state, 1);
        state.hint = 'You decked a bystander. Witnesses called it in.';
        state.hintTimer = 2.5;
      }
    }
    return events;
  }

  // Driving.
  const car = state.cars.find((c) => c.id === player.carId);
  if (!car) {
    player.onFoot = true;
    return events;
  }
  const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (held.up) car.speed += CAR.accel * dt;
  else if (held.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= car.speed * 1.1 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 4) {
    const dir = car.speed > 0 ? 1 : -1;
    car.angle += steer * CAR.turnRate * dir * Math.min(1, Math.abs(car.speed) / 220) * dt;
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  moveWithSlide(car, nx - car.x, ny - car.y, CAR.radius, state.buildings);
  if (car.x === before.x && car.y === before.y && (nx !== before.x || ny !== before.y)) {
    car.speed *= 0.4;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  // Running over a pedestrian at speed is a crime.
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 120) {
      ped.down = 4;
      events |= addCrime(state, 1);
    }
  }
  if (actions & 4) {
    player.onFoot = true;
    player.carId = -1;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    car.speed = 0;
    car.parked = true;
  }
  return events;
}

function stepMissions(state, dt) {
  if (state.complete || state.busted) return EVENT_NONE;
  const mission = MISSIONS[state.mission];
  if (!mission) return EVENT_NONE;
  const d = dist(state.player.x, state.player.y, mission.marker.x, mission.marker.y);
  if (state.mission === 1 && d < 56 && state.player.onFoot) {
    state.hint = 'You need wheels for this job.';
    state.hintTimer = 2;
    return EVENT_NONE;
  }
  if (state.mission === 2) {
    if (d < 56) {
      state.missionProgress += dt;
      if (state.missionProgress >= mission.holdSeconds) {
        state.take += mission.reward;
        state.mission = 3;
        state.missionProgress = 0;
        state.wanted = 3;
        state.crimeTimer = 0;
        spawnPolice(state, 2, null);
        state.hint = 'Vault cracked! Three stars — run!';
        state.hintTimer = 3;
        return EVENT_MISSION;
      }
    } else {
      state.missionProgress = 0;
    }
    return EVENT_NONE;
  }
  if (d < 56) {
    state.take += mission.reward;
    state.mission += 1;
    state.missionProgress = 0;
    if (state.mission >= MISSIONS.length) {
      state.complete = true;
      return EVENT_COMPLETE;
    }
    state.hint = `${mission.name} done. +$${mission.reward}`;
    state.hintTimer = 3;
    return EVENT_MISSION;
  }
  return EVENT_NONE;
}

export function stepWorld(state, held, actions, dt) {
  if (state.complete || state.busted) return EVENT_NONE;
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt);
  state.hintTimer = Math.max(0, state.hintTimer - dt);

  let events = stepPlayer(state, held, actions, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  events |= stepPolice(state, dt);
  if (state.busted) return events | EVENT_BUSTED;
  events |= stepMissions(state, dt);
  if (state.complete) return events | EVENT_COMPLETE;

  // Wanted heat: no crime for a while and the law cools off, one star at a time.
  if (state.wanted > 0) {
    state.crimeTimer += dt;
    if (state.crimeTimer > 18) {
      state.wanted -= 1;
      state.crimeTimer = 0;
    }
  }
  // Keep the pressure on: wanted stars bring police cars.
  const wantPolice = state.wanted > 0 ? Math.min(1 + state.wanted, 4) : 0;
  state.policeSpawnTimer -= dt;
  if (policeCount(state) < wantPolice && state.policeSpawnTimer <= 0) {
    spawnPolice(state, 1, null);
    state.policeSpawnTimer = 2;
  }
  return events;
}

// Helpers the screenshot stager uses to build each scene.
export function teleportPlayer(state, x, y) {
  state.player.x = x;
  state.player.y = y;
}

export function stealCarAt(state, x, y) {
  const car = nearestCar(state, x, y, 200, false);
  if (!car) return null;
  state.player.onFoot = false;
  state.player.carId = car.id;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  car.traffic = false;
  car.parked = false;
  car.speed = 0;
  return car;
}

export function setMission(state, index) {
  state.mission = index;
  state.missionProgress = 0;
  state.take = MISSIONS.slice(0, index).reduce((sum, m) => sum + m.reward, 0);
}

export function surgePolice(state, count, near) {
  spawnPolice(state, count, near);
}

/** Place police cars at exact road points (the chase scene wants them in frame). */
export function placePolice(state, positions) {
  for (const [x, y] of positions) {
    state.cars.push({
      id: 2000 + Math.floor(state.time * 60) + state.cars.length,
      x, y,
      angle: angleTo(x, y, state.player.x, state.player.y),
      speed: POLICE.speed,
      color: '#e8ecf4',
      traffic: false, parked: false, police: true,
      health: CAR.health, ramCooldown: 0, turnAt: null,
      ox: state.rng.range(-70, 70), oy: state.rng.range(-70, 70),
    });
  }
}

export function currentMission(state) {
  return MISSIONS[state.mission] ?? null;
}

export function playerCar(state) {
  if (state.player.onFoot) return null;
  return state.cars.find((c) => c.id === state.player.carId) ?? null;
}
