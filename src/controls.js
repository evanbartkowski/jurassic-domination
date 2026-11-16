/** Input adapters produce intents only; simulation owns all gameplay outcomes. */
export const ACTIONS = [
  ["up", "Move forward", "KeyW"], ["down", "Move backward", "KeyS"],
  ["left", "Move left", "KeyA"], ["right", "Move right", "KeyD"],
  ["attack", "Bite / attack", "Space"], ["ability", "Species ability", "KeyQ"],
  ["technique", "Species technique", "ControlLeft"], ["special", "Species special", "KeyX"],
  ["dash", "Dodge / dash", "KeyR"], ["sprint", "Sprint", "ShiftLeft"],
  ["eat", "Eat / hatch", "KeyE"], ["evolve", "Evolution choices", "KeyT"],
  ["journal", "Bloodline journal", "KeyJ"], ["map", "Expand map", "KeyM"],
  ["crouch", "Stalk / aquatic dive", "KeyH"], ["fieldJournal", "Field journal / ancestry", "KeyL"],
  ["guide", "Encyclopedia", "Tab"],
  ['build','Mutation builds','KeyB'],
  ["roar", "Terrifying Roar", "KeyZ"],
  ...["F", "G", "Y", "V", "U", "N"].map((key, i) => ["skill" + i, "Relic skill " + (i + 1), "Key" + key]),
];
export const DEFAULT_BINDINGS = Object.freeze(Object.fromEntries(ACTIONS.map(([action, , key]) => [action, key])));
const actions = new Set(ACTIONS.map(([action]) => action));
export function validBinding(code) {
  return typeof code === "string" && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Control(Left|Right))$/.test(code);
}
export function normalizeBindings(raw = {}) {
  const result = { ...DEFAULT_BINDINGS };
  if (raw?.dash === "ShiftLeft" && raw?.sprint === "ControlLeft" && raw?.technique === "KeyR") raw = {...raw, dash:"KeyR", sprint:"ShiftLeft", technique:"ControlLeft"};
  // Apply changes by swapping so malformed imports cannot duplicate keys or
  // silently leave another action without a usable control.
  for (const [action] of ACTIONS) if (validBinding(raw?.[action])) {
    if(action==='skill4'&&!raw.build&&raw.skill4==='KeyB')continue;
    const other = ACTIONS.find(([id]) => id !== action && result[id] === raw[action]);
    if (other) result[other[0]] = result[action];
    result[action] = raw[action];
  }
  return result;
}
export function rebind(raw, action, code) {
  const result = normalizeBindings(raw);
  if (!actions.has(action) || !validBinding(code)) return null;
  const other = ACTIONS.find(([id]) => id !== action && result[id] === code);
  if (other) result[other[0]] = result[action];
  result[action] = code;
  return result;
}
export function keyLabel(code = "") {
  return code.replace(/^Key|^Digit/, "").replace("Control", "CTRL ").replace("Shift", "SHIFT ").replace("Left", "L").replace("Right", "R").replace("Arrow", "ARROW ").toUpperCase();
}
export function actionHeld(action, keys, pending, bindings = DEFAULT_BINDINGS) {
  const code = bindings[action] || DEFAULT_BINDINGS[action];
  if (keys.has(code) || pending?.has(code)) return true;
  const alternative = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", roar: code===DEFAULT_BINDINGS.roar?'KeyC':null }[action];
  if (alternative && !Object.entries(bindings).some(([id, key]) => id !== action && key === alternative) && (keys.has(alternative) || pending?.has(alternative))) return true;
  if (["technique", "sprint"].includes(action) && code === DEFAULT_BINDINGS[action]) {
    const secondary = code.replace("Left", "Right");
    return keys.has(secondary) || !!pending?.has(secondary);
  }
  return false;
}
/** Standard Gamepad mapping, no device polling or side effects in the simulation. */
export function gamepadIntent(pad,threshold=.18) {
  const dz=Number.isFinite(threshold)?Math.max(.05,Math.min(.4,threshold)):.18;
  const deadzone=v=>Number.isFinite(v)&&Math.abs(v)>dz?Math.sign(v)*(Math.min(1,Math.abs(v))-dz)/(1-dz):0;
  const empty = { connected:false, anyButton:false,accept:false,back:false,navX:0,navY:0,x: 0, y: 0, aim: null, attack: false, ability: false, technique: false, special: false, roar: false, dash: false, sprint: false, eat: false, evolve: false, pause: false, map: false, skill: -1 };
  if (!pad?.connected || pad.mapping !== "standard") return empty;
  const button = (i) => !!pad.buttons?.[i]?.pressed;
  const ax = deadzone(pad.axes?.[0]), ay = deadzone(pad.axes?.[1]),
    rx = deadzone(pad.axes?.[2]), ry = deadzone(pad.axes?.[3]);
  return { ...empty,
    connected:true,anyButton:(pad.buttons||[]).some(b=>b.pressed),accept:button(0),back:button(1),navX:ax||Number(button(15))-Number(button(14)),navY:ay||Number(button(13))-Number(button(12)),
    x: ax || Number(button(15)) - Number(button(14)),
    y: ay || Number(button(13)) - Number(button(12)),
    aim: Math.hypot(rx, ry) > 0.2 ? Math.atan2(ry, rx) : null,
    attack: button(7), ability: button(5), technique: button(4), special: button(3), roar: button(11),
    dash: button(0), sprint: button(10), crouch: button(6), eat: button(2), evolve: button(1),
    pause: button(9), map: button(8),
  };
}
