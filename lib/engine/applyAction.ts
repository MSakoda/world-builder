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
    case 'take':
      const items = room.items;
      const itemName = world.items[action.target].name;
      // check if there is an item
      if( items.includes(action.target)) {
        const haveItemAlready = updatedState.inventory.includes(action.target);
        if( world.items[action.target].portable && !haveItemAlready ) {
          // add it to inventory
          updatedState.inventory = [...updatedState.inventory, action.target]
          result.message = `Added ${itemName} to inventory.`;
        } else {
          // Item is not movable or already have the item
          result = {
            success: false,
            message : haveItemAlready ? `You already have ${itemName}` : `${itemName} is not portable.  You could not add it to your inventory.`
          }
        }
      } else {
        result ={
          success: false,
          message:  `${itemName} does not exist in this room.`
        }
      }
      break;
    case 'use':
      break;
    case 'look':
      // return description of current room
      result.message = room.description;
      break;
    default:
      break;
  }
  return { state: updatedState, result }
}
