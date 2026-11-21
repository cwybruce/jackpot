// JACKPOT — a casino heist at night in Port Vane. Tuning and layout constants.
// The city is a night grid: four horizontal roads, four vertical roads, and the blocks
// between them hold the buildings. Everything the game draws or simulates reads from here.
export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const H_ROADS = [320, 760, 1200, 1640];
export const V_ROADS = [320, 880, 1440, 2000];
export const ROAD_HALF = 48;

export const PLAYER = {
  walkSpeed: 175,
  radius: 13,
  health: 100,
};

export const CAR = {
  accel: 430,
  brake: 620,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.6,
  radius: 15,
  health: 100,
};

export const POLICE = {
  speed: 475,
  turnRate: 3.1,
  ramDamage: 7,
  ramCooldown: 0.9,
};

// Missions: a dealer-turned-grifter, Danny Vale, works the Gilded Palm casino in one night.
// The take adds up to exactly $7,820 when the last job lands.
export const MISSIONS = [
  {
    id: 1,
    name: 'M1 — The Inside Man',
    brief: 'Walk into the Gilded Palm. Reach the casino entrance.',
    marker: { x: 1160, y: 760 },
    reward: 120,
  },
  {
    id: 2,
    name: 'M2 — Hot Pickup',
    brief: 'Steal a getaway car (E beside one), then drive to the garage.',
    marker: { x: 320, y: 1200 },
    reward: 400,
  },
  {
    id: 3,
    name: 'M3 — Crack the Vault',
    brief: 'Hold at the vault door for 3 seconds. The alarm will scream.',
    marker: { x: 1500, y: 760 },
    holdSeconds: 3,
    reward: 1800,
  },
  {
    id: 4,
    name: 'M4 — The Long Goodbye',
    brief: 'Lose the heat. Reach the Harbor Gate with the take.',
    marker: { x: 2240, y: 1640 },
    reward: 5500,
  },
];

export const FINAL_TAKE = 7820;
export const BEST_KEY = 'jackpot-best-take';

// The city never sleeps: traffic and foot traffic counts.
export const TRAFFIC_CARS = 10;
export const PEDESTRIANS = 14;
export const PARKED_CARS = 6;

export const COLORS = {
  night: '#0a0d1c',
  block: '#11142a',
  road: '#1d2338',
  roadEdge: '#2c3552',
  lane: '#8a7d3a',
  sidewalk: '#232a44',
  casinoGold: '#d4a017',
  casinoPink: '#ff4d8d',
  player: '#ffd23f',
  policeA: '#e8ecf4',
  policeB: '#14181f',
};

export const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#7f8c8d', '#16a085'];
