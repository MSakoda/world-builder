import { describe, test, it, expect, beforeEach } from "vitest";
import { GameState } from './types';
import { applyAction } from "./applyAction";
import { world } from './world';

// Fill these in. Each one replaces `test.todo(...)` with
// `test("...", () => { ... })` and asserts on the return value of
// applyAction(state, action, world).

describe("applyAction", () => {
  const state = {
    currentRoom: 'entrance',
    inventory: [],
    flags: {}
  } as GameState;
  beforeEach(() => {
    state.currentRoom = 'entrance';
    state.inventory= [];
  })
  it('should fail when going through a locked exit without the key', () => {
    const result = applyAction(state, { verb: 'go', direction: 'south'}, world )
    expect(result.result.success).toBe(false);
    expect(result.state.currentRoom).toEqual('entrance');
  })
  it('should succeed when going through a locked exit with the key', () => {
    state.inventory = ['key'];
    const result = applyAction(state, { verb: 'go', direction: 'south'}, world )
    expect(result.result.success).toBe(true);
    expect(result.state.currentRoom).toEqual('cellar');
  })
  it('should fail when taking a non-portable item', () => {
    const result = applyAction(state, { verb: 'take', target: 'statue'}, world )
    expect(result.result.success).toBe(false);
    expect(result.state.inventory).not.toContain('statue');
  })
  it('should fail when taking an item a second time', () => {
    state.inventory = [];
    let result = applyAction(state, { verb: 'take', target: 'key'}, world )
    result = applyAction(result.state, { verb: 'take', target: 'key'}, world )
    expect(result.result.success).toBe(false);
    expect(result.state.inventory.length).toEqual(1);
  })
});
