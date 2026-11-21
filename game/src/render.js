// The renderer: paints the night city, the cars and people on it, and the HUD —
// cash, wanted stars, mission banner, health and a live minimap — then the screens
// (title, paused, busted, complete) over the world.
import {
  WORLD,
  VIEW,
  H_ROADS,
  V_ROADS,
  ROAD_HALF,
  MISSIONS,
  COLORS,
  FINAL_TAKE,
} from './config.js';
import { currentMission, playerCar } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

function hashSeed(n) {
  let s = (n * 2654435761) >>> 0;
  s ^= s >>> 15;
  s = Math.imul(s, 2246822519);
  s ^= s >>> 13;
  return ((s >>> 0) % 1000) / 1000;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function camera(state) {
    const px = state.player.x;
    const py = state.player.y;
    let x = px - VIEW.width / 2;
    let y = py - VIEW.height / 2;
    x = Math.max(0, Math.min(WORLD.width - VIEW.width, x));
    y = Math.max(0, Math.min(WORLD.height - VIEW.height, y));
    if (state.shake > 0) {
      x += (Math.random() - 0.5) * state.shake * 22;
      y += (Math.random() - 0.5) * state.shake * 22;
    }
    return { x, y };
  }

  function drawRoads(cam) {
    ctx.fillStyle = COLORS.road;
    for (const ry of H_ROADS) ctx.fillRect(0, ry - ROAD_HALF - cam.y, WORLD.width, ROAD_HALF * 2);
    for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_HALF - cam.x, 0, ROAD_HALF * 2, WORLD.height);
    // Centre dashes.
    ctx.fillStyle = COLORS.lane;
    for (const ry of H_ROADS) {
      for (let x = 0; x < WORLD.width; x += 64) {
        ctx.fillRect(x + 8 - cam.x, ry - 2 - cam.y, 34, 4);
      }
    }
    for (const rx of V_ROADS) {
      for (let y = 0; y < WORLD.height; y += 64) {
        ctx.fillRect(rx - 2 - cam.x, y + 8 - cam.y, 4, 34);
      }
    }
  }

  function drawBuildings(state, cam) {
    for (const b of state.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > VIEW.width || y > VIEW.height || x + b.w < 0 || y + b.h < 0) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
      // Lit windows, deterministic per building.
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const lit = hashSeed((b.seed ?? 7) + c * 31 + r * 17) > 0.45;
          if (!lit) continue;
          ctx.fillStyle = hashSeed((b.seed ?? 7) + c * 7 + r * 13) > 0.8 ? '#ffd98a' : '#9fc3ff';
          ctx.fillRect(x + 8 + c * 34, y + 8 + r * 30, 14, 11);
        }
      }
      if (b.neon) {
        ctx.fillStyle = COLORS.casinoGold;
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, x + b.w / 2, y + 34);
        ctx.fillStyle = COLORS.casinoPink;
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('★ CASINO • HOTEL • SLOTS ★', x + b.w / 2, y + 58);
        // Neon edge glow.
        ctx.strokeStyle = COLORS.casinoPink;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, y + 4, b.w - 8, b.h - 8);
      }
    }
  }

  function drawMarker(state, cam) {
    const mission = currentMission(state);
    if (!mission || state.complete) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    const x = mission.marker.x - cam.x;
    const y = mission.marker.y - cam.y;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Vault hold progress ring.
    if (state.mission === 2 && state.missionProgress > 0) {
      ctx.strokeStyle = '#ff4d8d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + (state.missionProgress / 3) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mission.name, x, y - 46);
  }

  function drawCarShape(car, cam, isPlayer) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.police ? COLORS.policeB : car.color;
    ctx.fillRect(-19, -10, 38, 20);
    ctx.fillStyle = car.police ? COLORS.policeA : 'rgba(255,255,255,0.25)';
    ctx.fillRect(-6, -9, 12, 18);
    ctx.fillStyle = '#0a0d1c';
    ctx.fillRect(6, -8, 8, 16);
    if (car.police) {
      const phase = Math.floor(Date.now() / 280) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-14, -11, 8, 4);
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-14, 7, 8, 4);
    }
    // Headlight cone at night.
    ctx.fillStyle = 'rgba(255,240,180,0.10)';
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(78, -26);
    ctx.lineTo(78, 26);
    ctx.lineTo(18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.police) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', x, y - 22);
    }
  }

  function drawWorld(state, cam, screen) {
    ctx.fillStyle = COLORS.night;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // City blocks.
    ctx.fillStyle = COLORS.block;
    ctx.fillRect(-cam.x, -cam.y, WORLD.width, WORLD.height);
    drawRoads(cam);
    drawBuildings(state, cam);
    if (screen !== SCREEN_TITLE) drawMarker(state, cam);
    // Pedestrians.
    for (const ped of state.peds) {
      const x = ped.x - cam.x;
      const y = ped.y - cam.y;
      if (x < -20 || y < -20 || x > VIEW.width + 20 || y > VIEW.height + 20) continue;
      ctx.fillStyle = ped.down > 0 ? '#666' : ped.color;
      ctx.beginPath();
      ctx.arc(x, y, ped.down > 0 ? 7 : 6, 0, Math.PI * 2);
      ctx.fill();
      if (ped.down > 0) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 9);
        ctx.lineTo(x + 5, y - 9);
        ctx.stroke();
      }
    }
    // Cars: traffic and police first, the player's car on top.
    const myCar = playerCar(state);
    for (const car of state.cars) {
      if (myCar && car.id === myCar.id) continue;
      drawCarShape(car, cam, false);
    }
    if (myCar) drawCarShape(myCar, cam, true);
    // The player on foot.
    if (state.player.onFoot) {
      const x = state.player.x - cam.x;
      const y = state.player.y - cam.y;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(state.player.angle) * 18, y + Math.sin(state.player.angle) * 18);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DANNY', x, y - 20);
    }
  }

  function drawMinimap(state) {
    const mw = 216;
    const mh = 162;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(6,8,18,0.82)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#3a4568';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.fillStyle = '#2c3552';
    for (const ry of H_ROADS) ctx.fillRect(mx, my + ry * sy - 2, mw, 4);
    for (const rx of V_ROADS) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    ctx.fillStyle = COLORS.casinoGold;
    ctx.fillRect(mx + 960 * sx - 3, my + 400 * sy - 3, 7, 7);
    const mission = currentMission(state);
    if (mission && !state.complete) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx + mission.marker.x * sx, my + mission.marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (!car.police) continue;
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PORT VANE', mx + 6, my + 14);
  }

  function drawHud(state, best) {
    // Top bar.
    ctx.fillStyle = 'rgba(6,8,18,0.72)';
    ctx.fillRect(0, 0, VIEW.width, 64);
    const mission = currentMission(state);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(state.complete ? 'JACKPOT — job done' : (mission ? mission.name : ''), 16, 26);
    ctx.fillStyle = '#c8d2ea';
    ctx.font = '14px sans-serif';
    ctx.fillText(state.complete ? `Take $${FINAL_TAKE.toLocaleString()}` : (mission ? mission.brief : ''), 16, 48);
    // Cash.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7dff9a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${state.take.toLocaleString()}`, VIEW.width - 16, 30);
    ctx.fillStyle = '#c8d2ea';
    ctx.font = '12px sans-serif';
    ctx.fillText(`BEST $${Math.max(best, state.take).toLocaleString()}`, VIEW.width - 16, 50);
    // Wanted stars, under the cash.
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    ctx.fillStyle = state.wanted > 0 ? '#ffb02e' : '#5a6480';
    ctx.fillText(stars, VIEW.width - 16, 92);
    // Health / car integrity, bottom left.
    const myCar = playerCar(state);
    const label = myCar ? 'RIDE' : 'DANNY';
    const hp = myCar ? myCar.health : state.player.health;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(6,8,18,0.72)';
    ctx.fillRect(16, VIEW.height - 44, 220, 28);
    ctx.fillStyle = hp > 50 ? '#7dff9a' : hp > 25 ? '#ffb02e' : '#ff4d4d';
    ctx.fillRect(20, VIEW.height - 38, 160 * (hp / 100), 16);
    ctx.strokeStyle = '#3a4568';
    ctx.strokeRect(20, VIEW.height - 38, 160, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${label} ${Math.round(hp)}`, 188, VIEW.height - 24);
    // Hint line.
    if (state.hintTimer > 0 && state.hint) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.hint, VIEW.width / 2, VIEW.height - 56);
    }
    // Vault hold progress.
    if (state.mission === 2 && state.missionProgress > 0) {
      ctx.fillStyle = '#ff4d8d';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`CRACKING THE VAULT… ${Math.ceil(3 - state.missionProgress)}`, VIEW.width / 2, 96);
    }
    drawMinimap(state);
    // Controls reminder.
    ctx.fillStyle = 'rgba(200,210,234,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move / drive • E steal or exit car • SPACE punch • P pause', 16, VIEW.height - 52);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4,6,14,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, VIEW.width / 2, 220);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '20px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 280 + i * 34));
  }

  return {
    draw(state, screen, best) {
      const cam = camera(state);
      drawWorld(state, cam, screen);
      if (screen === SCREEN_PLAY) {
        drawHud(state, best);
        return;
      }
      if (screen === SCREEN_TITLE) {
        drawHud(state, best);
        overlay('JACKPOT', [
          'A casino heist in one night — Port Vane, after dark.',
          'Danny Vale, dealer turned grifter, works the Gilded Palm.',
          'Four jobs. One take: $7,820. Do not get caught.',
          '',
          'WASD move and drive  •  E steal a car  •  SPACE punch  •  P pause',
          'Press ENTER to play',
        ], COLORS.casinoGold);
        return;
      }
      if (screen === SCREEN_PAUSED) {
        drawHud(state, best);
        overlay('PAUSED', ['The night waits. Press P to keep working.'], '#9fb2d8');
        return;
      }
      if (screen === SCREEN_OVER) {
        overlay('BUSTED', [
          'The Port Vane PD caught up with Danny Vale.',
          `Take kept: $${state.take.toLocaleString()}`,
          'Press ENTER to try the night again',
        ], '#ff4d4d');
        return;
      }
      if (screen === SCREEN_COMPLETE) {
        overlay('JACKPOT!', [
          'The Long Goodbye is complete. The Gilded Palm never saw it coming.',
          `FINAL TAKE  $${FINAL_TAKE.toLocaleString()}`,
          `BEST TAKE  $${Math.max(best, FINAL_TAKE).toLocaleString()}`,
          'Press ENTER to run it back',
        ], COLORS.casinoGold);
      }
    },
  };
}
