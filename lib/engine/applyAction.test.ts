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
    it('should succeed when going through an unlocked exit', () => {
    state.inventory = ['key'];
    let result = applyAction(state, { verb: 'go', direction: 'south'}, world )
    result = applyAction(result.state, { verb: 'go', direction: 'north'}, world )
    expect(result.result.success).toBe(true);
    expect(result.state.currentRoom).toEqual('entrance');
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

describe("applyAction edge cases", () => {
  const base = { currentRoom: "entrance", inventory: [], flags: {} } as GameState;

  it("fails (does not throw) when taking an unknown item", () => {
    const { result, state } = applyAction(base, { verb: "take", target: "sword" }, world);
    expect(result.success).toBe(false);
    expect(state).toEqual(base);
  });
  it("fails when taking an item that is not in the current room", () => {
    const cellar = { ...base, currentRoom: "cellar" };
    const { result } = applyAction(cellar, { verb: "take", target: "key" }, world);
    expect(result.success).toBe(false);
  });
  it("use fails for an item you don't hold and succeeds for one you do", () => {
    expect(applyAction(base, { verb: "use", target: "key" }, world).result.success).toBe(false);
    const held = { ...base, inventory: ["key"] };
    const { result, state } = applyAction(held, { verb: "use", target: "key" }, world);
    expect(result.success).toBe(true);
    expect(result.message).not.toBe("");
    expect(state).toEqual(held);
  });
  it("fails on an unknown verb", () => {
    const { result } = applyAction(base, { verb: "dance" } as never, world);
    expect(result.success).toBe(false);
    expect(result.message).not.toBe("");
  });
});
