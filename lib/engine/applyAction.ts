import type { Action, ActionResult, GameState, World } from "./types";

const fail = (message: string): ActionResult => ({ success: false, message });

/**
 * Pure. Given a state, an action, and the world, return the NEW state and
 * a result describing what happened. Never mutate `state` — always build
 * and return a new object.
 */
export function applyAction(
  state: GameState,
  action: Action,
  world: World
): { state: GameState; result: ActionResult } {
  const room = world.rooms[state.currentRoom];

  switch (action.verb) {
    case "go": {
      const exit = room.exits[action.direction];
      if (!exit) return { state, result: fail(`There is no exit to the ${action.direction}`) };

      if (exit.requiredItem && !state.inventory.includes(exit.requiredItem)) {
        const name = world.items[exit.requiredItem]?.name ?? exit.requiredItem;
        return {
          state,
          result: fail(exit.lockedMessage ?? `${name} is required to go ${action.direction}`),
        };
      }
      if (exit.requiredFlag && !state.flags[exit.requiredFlag]) {
        return { state, result: fail(exit.lockedMessage ?? "Something blocks the way.") };
      }

      const target = world.rooms[exit.to];
      if (target.ending) {
        return {
          state: { ...state, currentRoom: exit.to, flags: { ...state.flags, won: true } },
          result: { success: true, message: `Went to ${target.title}. You win!` },
        };
      }
      return {
        state: { ...state, currentRoom: exit.to },
        result: { success: true, message: `Went to ${target.title}` },
      };
    }

    case "take": {
      const item = world.items[action.target];
      if (!item) return { state, result: fail(`There is no ${action.target} here.`) };
      if (!room.items.includes(action.target)) {
        return { state, result: fail(`${item.name} does not exist in this room.`) };
      }
      if (state.inventory.includes(action.target)) {
        return { state, result: fail(`You already have ${item.name}`) };
      }
      if (!item.portable) {
        return {
          state,
          result: fail(`${item.name} is not portable.  You could not add it to your inventory.`),
        };
      }
      return {
        state: { ...state, inventory: [...state.inventory, action.target] },
        result: { success: true, message: `Added ${item.name} to inventory.` },
      };
    }

    case "use": {
      const item = world.items[action.target];
      if (!item) return { state, result: fail(`There is no ${action.target} here.`) };
      if (!state.inventory.includes(action.target)) {
        return { state, result: fail(`You don't have ${item.name}.`) };
      }
      const interaction = world.interactions.find(
        (i) => i.roomId === state.currentRoom && i.itemId === action.target,
      );
      if (!interaction) {
        return {
          state,
          result: { success: true, message: `You use the ${item.name}, but nothing happens.` },
        };
      }
      if (state.flags[interaction.flag]) {
        return { state, result: { success: true, message: "Nothing more happens." } };
      }
      return {
        state: {
          ...state,
          flags: { ...state.flags, [interaction.flag]: true },
          inventory: interaction.consume
            ? state.inventory.filter((id) => id !== action.target)
            : state.inventory,
        },
        result: { success: true, message: interaction.message },
      };
    }

    case "look":
      return { state, result: { success: true, message: room.description } };

    default:
      return { state, result: fail("I don't understand that.") };
  }
}
