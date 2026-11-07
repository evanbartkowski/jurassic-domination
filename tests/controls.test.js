import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BINDINGS, ACTIONS, normalizeBindings, rebind, actionHeld, gamepadIntent } from "../src/controls.js";
test("rebind swaps conflicting controls and survives settings normalization", () => {
  const controls = rebind(DEFAULT_BINDINGS, "ability", "KeyE");
  assert.equal(controls.eat, "KeyQ");
  assert.equal(controls.ability, "KeyE");
  assert.deepEqual(normalizeBindings(controls), controls);
  assert.equal(new Set(Object.values(controls)).size, ACTIONS.length);
  assert.equal(rebind(controls, "ability", "Escape"), null);
  assert.equal(rebind(controls, "money", "KeyP"), null);
  assert.deepEqual(normalizeBindings(null), DEFAULT_BINDINGS);
});
test("physical keys obey remaps, retain movement alternatives and release cleanly", () => {
  const controls = rebind(DEFAULT_BINDINGS, "attack", "KeyZ");
  assert.equal(actionHeld("attack", new Set(["Space"]), null, controls), false);
  assert.equal(actionHeld("attack", new Set(), new Set(["KeyZ"]), controls), true);
  assert.equal(actionHeld("left", new Set(["ArrowLeft"]), null, controls), true);
  assert.equal(actionHeld("sprint", new Set(["ControlRight"]), null, controls), true);
  assert.equal(actionHeld("attack", new Set(), null, controls), false);
});
test("standard controller axes have a deadzone and buttons map to distinct intents", () => {
  const pad = { connected: true, mapping: "standard", axes: [.1, -.8, 1, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  pad.buttons[7].pressed = true; pad.buttons[2].pressed = true;
  const input = gamepadIntent(pad);
  assert.equal(input.x, 0); assert.ok(input.y < -.7); assert.equal(input.aim, 0);
  assert.ok(input.attack && input.eat); assert.equal(input.ability, false);
  assert.equal(gamepadIntent({ ...pad, connected: false }).attack, false);
  assert.equal(gamepadIntent({ ...pad, mapping: "" }).x, 0);
});
