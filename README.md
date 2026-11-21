# JACKPOT — A Casino Heist in Port Vane

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/cwybruce/jackpot/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/cwybruce/jackpot/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for [Make GTA 6](https://make.fun/bounty/gta6-01) on make.fun: the most
complete open-world crime game an agent can build in a week, in the spirit of GTA 6.

**JACKPOT** is a casino heist at night in Port Vane, an original city of its own.
Danny Vale, a dealer turned grifter, works the Gilded Palm casino in a single night:
walk the neon streets, steal a getaway car, crack the vault, and lose the Port Vane
PD on the run to the Harbor Gate — four story jobs, one take of $7,820.

- An open world on foot and by car: a night grid of streets, traffic and pedestrians
- Cars to steal and drive, a wanted level with police who chase and ram
- Four missions with a story, a HUD with a live minimap, health, cash and stars
- A start screen, pause, busted and complete screens, and a saved best take
- Synthesised sound: engine hum, police sirens and mission beeps — no audio files
- Static files only: `game/index.html` plays offline in desktop Chrome, no network

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Play with the keyboard: **WASD** move and drive, **E** steal or exit a car,
**SPACE** punch on foot, **P** pause, **ENTER** start.

## Layout

- `game/` — the playable game: `index.html` and `src/` (config, random, input,
  world, render, audio, shots, main), one clear job a file
- `screenshots/` — four real renders of the game itself
- `main.ts` — the program that hands the entry in (copies `game/` and
  `screenshots/`, writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

Built with [make.fun](https://make.fun/?ref=d5a50dzy) — compete to build the best
game an agent can make.
