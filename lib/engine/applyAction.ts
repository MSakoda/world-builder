import type { Action, ActionResult, GameState, World } from "./types";

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
  // implement. Handle "go", "take", "use", "look".
  const updatedState = {...state};
    let result : ActionResult = {
    success: true,
    message: ''
  }
  const room = world.rooms[state.currentRoom]
  switch(action.verb) {
    case 'go':
      // check if room exists in direction
      if( room.exits[action.direction]) {
        // check if room has requiredItem
        const requiredItem = room.exits[action.direction]?.requiredItem
        if( requiredItem ) {
          if ( state.inventory.includes(requiredItem) ) { // Do you have the item?
            result.message = `Went to ${room.exits[action.direction]!.to}`;
            updatedState.currentRoom = room.exits[action.direction]!.to
          } else {
            result = {
              success: false,
              message: `${world.items[requiredItem].name} is required to go ${action.direction}`
            }
          }
        } else {
          result.message = `Went to ${room.exits[action.direction]?.to}`;
          updatedState.currentRoom = room.exits[action.direction]!.to
        }   
      } else {
        result = {
          success: false,
          message: `There is no exit to the ${action.direction}`
        }
      }
      break;
    case 'take': {
      const item = world.items[action.target];
      if (!item) {
        result = { success: false, message: `There is no ${action.target} here.` };
      } else if (!room.items.includes(action.target)) {
        result = { success: false, message: `${item.name} does not exist in this room.` };
      } else if (updatedState.inventory.includes(action.target)) {
        result = { success: false, message: `You already have ${item.name}` };
      } else if (!item.portable) {
        result = { success: false, message: `${item.name} is not portable.  You could not add it to your inventory.` };
      } else {
        updatedState.inventory = [...updatedState.inventory, action.target];
        result.message = `Added ${item.name} to inventory.`;
      }
      break;
    }
    case 'use': {
      const item = world.items[action.target];
      if (!item) {
        result = { success: false, message: `There is no ${action.target} here.` };
      } else if (!state.inventory.includes(action.target)) {
        result = { success: false, message: `You don't have ${item.name}.` };
      } else {
        // v1 has no item effects: exits unlock just by carrying the key.
        result.message = `You use the ${item.name}, but nothing happens.`;
      }
      break;
    }
    case 'look':
      // return description of current room
      result.message = room.description;
      break;
    default:
      result = { success: false, message: "I don't understand that." };
      break;
  }
  return { state: updatedState, result }
}
