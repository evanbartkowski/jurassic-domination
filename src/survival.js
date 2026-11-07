import { phenotype, newAdaptationState, recordExposure, adaptationLabel, acquiredAdaptations } from './genetics.js';
import { conditionsAt } from './world-events.js';
import { terrainCover } from './senses.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function newSurvivalState() {
  return { version: 1, temperature: 0, fatigue: 0, strain: 0, nextNotice: 0 };
}
export function validSurvival(state) {
  return state?.version === 1 && ['temperature', 'fatigue', 'strain', 'nextNotice'].every(k => Number.isFinite(state[k])) &&
    Math.abs(state.temperature) <= 1 && state.fatigue >= 0 && state.fatigue <= 100 && state.strain >= 0 && state.strain <= 12 && state.nextNotice >= 0;
}
export function movementMode(species) {
  return species.body === 'marine' ? 'aquatic' : species.body === 'croc' ? 'amphibious' :
    ['bird', 'dragon', 'gryphon'].includes(species.body) ? 'wing-assisted' : 'terrestrial';
}
export function inWater(game, actor = game.player) {
  return (game.worldFeatures || []).some(f => f.type === 'water' && Math.hypot(actor.x - f.x, actor.y - f.y) < f.radius);
}
export function survivalSpeed(game) {
  const p = game.player, s = game.survival, wet = inWater(game), mode = movementMode(game.species),
    genes = game.geneticTraits || phenotype(p.genome),
    adaptedSwimmer = wet && (genes.adaptations.includes('water') || p.adaptations?.water >= 75);
  return (p.crouching && !p.submerged ? .64 : 1) * (mode === 'aquatic' ? wet ? 1.3 : .72 : mode === 'amphibious' && wet ? 1.12 : 1) *
    (adaptedSwimmer ? 1.04 : 1) * (1 - (s?.fatigue || 0) * .0008) * (s?.strain > 0 ? .92 : 1) * conditionsAt(game, p.x, p.y).movementMultiplier;
}
export function setMovementPosture(game, input) {
  const p = game.player;
  p.crouching = !!input.crouch && !input.sprint;
  p.submerged = p.crouching && inWater(game) && ['aquatic', 'amphibious'].includes(movementMode(game.species));
}
/** Exposure is slow, signalled and recoverable; no extra resource gauges to maintain. */
export function updateSurvival(game, dt, input, moving) {
  const p = game.player, state = game.survival ||= newSurvivalState(), wet = inWater(game),
    mode = movementMode(game.species), conditions = conditionsAt(game, p.x, p.y), genes = game.geneticTraits || phenotype(p.genome);
  p.adaptations ||= newAdaptationState();
  setMovementPosture(game, input);
  const sprinting = !!input.sprint && moving && p.stamina > 2;
  state.fatigue = clamp(state.fatigue + (sprinting ? .8 : moving ? -1.3 : -3.5) * dt, 0, 100);
  state.strain = Math.max(0, state.strain - dt * (moving ? 1 : p.hunger > 50 ? 2 : 1.5));
  const coldResist = genes.adaptations.includes('frost') || p.adaptations.frost >= 90,
    heatResist = genes.adaptations.includes('cinder') || p.adaptations.cinder >= 90;
  let target = conditions.temperature < 5 ? -(5 - conditions.temperature) / 30 : conditions.temperature > 35 ? (conditions.temperature - 35) / 16 : 0;
  target *= target < 0 ? coldResist ? .55 : 1 : heatResist ? .55 : 1;
  if (wet && target > 0) target *= .35;
  // Calm starter shelter and a 60-second grace protect the first encounter.
  if (Math.hypot(p.x, p.y) < 55 || game.time < 60) target = 0;
  state.temperature = clamp(state.temperature + (clamp(target, -1, 1) - state.temperature) * (1 - Math.exp(-dt / 28)), -1, 1);
  if (Math.abs(state.temperature) > .65 && game.time >= state.nextNotice) {
    game.emit('warning', { text: state.temperature < 0 ? 'Exposure rising: seek warmer ground. Cold adaptations help.' : 'Heat exposure rising: seek water or cooler ground.' });
    state.nextNotice = game.time + 25;
  }
  if (Math.abs(state.temperature) > .92) game.damagePlayer(p.maxHp * .003 * dt, state.temperature < 0 ? 'Cold exposure' : 'Heat exposure', true);
  if (conditions.hazardDamagePerSecond) game.damagePlayer(conditions.hazardDamagePerSecond * dt, conditions.hazardCause, true);
  if (p.hp > p.maxHp * .4 && moving) {
    const expose = kind => {
      for (const id of recordExposure(p.adaptations, kind, dt)) game.emit('adaptation', { id, text: `Adapted: ${adaptationLabel(id)}` });
    };
    if (wet) expose('water');
    if (conditions.temperature < 5) expose('frost');
    if (conditions.temperature > 35) expose('cinder');
    if (p.crouching && terrainCover(game, p) > .2 && !game.entities.some(e => e.sensory?.detected && e.sensory?.visible && Math.hypot(e.x-p.x,e.y-p.y)<40)) expose('stealth');
  }
}
export function survivalStatus(game) {
  const s = game.survival || newSurvivalState(), p = game.player;
  return { mode: movementMode(game.species), wet: inWater(game), cover: terrainCover(game, p),
    label: p.submerged ? 'DIVING' : p.crouching ? 'STALKING' : s.strain > 0 ? 'RECOVERING' : s.fatigue > 50 ? 'WINDED' : 'STEADY',
    temperature: s.temperature, fatigue: s.fatigue, strain: s.strain, adaptations: acquiredAdaptations(p.adaptations) };
}
