// Keyboard input: WASD and arrows to move or drive, E to enter or steal a car,
// Space to punch on foot, Enter to confirm, P or Escape to pause.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;

  function onKeyDown(event) {
    const dir = KEYMAP[event.code];
    if (dir) {
      held[dir] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      if (event.code === 'Enter') actions |= ACTION_CONFIRM;
      else actions |= ACTION_PUNCH;
      event.preventDefault();
    } else if (event.code === 'KeyE') {
      actions |= ACTION_INTERACT;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    }
  }

  function onKeyUp(event) {
    const dir = KEYMAP[event.code];
    if (dir) held[dir] = false;
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);

  return {
    held,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // A virtual direction for the autopilot in shots.js: {up,down,left,right} booleans.
    setVirtual(directions) {
      held.up = !!directions.up;
      held.down = !!directions.down;
      held.left = !!directions.left;
      held.right = !!directions.right;
    },
  };
}
