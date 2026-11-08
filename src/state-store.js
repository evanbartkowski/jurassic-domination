import { loadData, normalizeProfile, normalizeSettings, PROFILE_KEY, SETTINGS_KEY } from "./profile.js";
import { migrateSnapshot, SNAPSHOT_VERSION, CONTENT_VERSION } from "./run-state.js";
import { PROFILE_VERSION } from "./profile.js";
import { mergeAncestry } from "./ancestry.js";

/** Offline journal. Checksums detect damage, not malicious save editing. */
export const SAVE_KEYS = Object.freeze({
  slots: ["jurassic-domination.save.a.v1", "jurassic-domination.save.b.v1"],
  head: "jurassic-domination.save.head.v1",
  terminal: "jurassic-domination.ended-runs.v1",
});
export const SAVE_VERSION = 1;
export const BACKUP_FORMAT = "jurassic-domination.backup";
const MAX_SAVE_BYTES = 20 * 1024 * 1024;
export const MAX_ACTIVE_CLAIMS = 65536;
const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 160;
const clone = (value) => JSON.parse(JSON.stringify(value));
const unique = (values) => [...new Set(values)];
export function saveChecksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const identity = (run) => run?.runId || run?.state?.runId || run?.game?.runId;
function validateRun(run) {
  if (run === null || run === undefined) return null;
  if (!validId(identity(run))) throw Error("The checkpoint is missing its run identity.");
  if (run.game?.state === "dead") throw Error("A dead life cannot be saved as an active run.");
  try { return migrateSnapshot(run); }
  catch { throw Error("The active-run checkpoint is invalid."); }
}
function normalizeData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !raw.profile || typeof raw.profile !== "object" || Array.isArray(raw.profile))
    throw Error("The save does not contain a player profile.");
  if (Array.isArray(raw.profile.activeFindClaims) && raw.profile.activeFindClaims.length > MAX_ACTIVE_CLAIMS)
    throw Error("This expedition exceeds the supported reward-history budget.");
  if (raw.profile.version > PROFILE_VERSION || raw.run?.version > SNAPSHOT_VERSION || raw.run?.contentVersion > CONTENT_VERSION)
    throw Error("This save belongs to a newer game version.");
  return { profile: normalizeProfile(raw.profile), settings: normalizeSettings(raw.settings), run: validateRun(raw.run) };
}
function parseEnvelope(text) {
  if (typeof text !== "string" || !text.length || text.length > MAX_SAVE_BYTES) return null;
  try {
    const envelope = JSON.parse(text), { checksum, ...body } = envelope;
    if (envelope.version !== SAVE_VERSION || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 ||
      typeof checksum !== "string" || saveChecksum(JSON.stringify(body)) !== checksum) return null;
    return { ...envelope, data: normalizeData(envelope.data) };
  } catch { return null; }
}
function parseTerminals(text) {
  if (!text) return [];
  if (text.length > MAX_SAVE_BYTES) throw Error("The completed-run ledger is too large.");
  const parsed = JSON.parse(text);
  if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.entries) ||
    saveChecksum(JSON.stringify(parsed.entries)) !== parsed.checksum) throw Error("The completed-run ledger is damaged.");
  if (parsed.entries.some((entry) => !validId(entry.id) || !Number.isSafeInteger(entry.revision) || typeof entry.checksum !== "string"))
    throw Error("The completed-run ledger is invalid.");
  return parsed.entries;
}
function mergeTerminals(...groups) {
  const entries = new Map();
  for (const entry of groups.flat()) if (validId(entry.id)) {
    const previous = entries.get(entry.id);
    if (!previous || entry.revision >= previous.revision) entries.set(entry.id, { ...entry });
  }
  return [...entries.values()];
}
function containsFutureSave(texts = []) {
  return texts.some((text) => {
    try {
      const raw = JSON.parse(text || "null");
      return raw && (raw.version > SAVE_VERSION || raw.data?.profile?.version > PROFILE_VERSION ||
        raw.data?.run?.version > SNAPSHOT_VERSION || raw.data?.run?.contentVersion > CONTENT_VERSION);
    } catch { return false; }
  });
}

export class SaveStore {
  constructor(storage) {
    this.storage = storage;
    this.revision = 0;
    this.slot = 1;
    this.data = null;
    this.terminals = [];
    this.lastError = "";
    this.locked = false;
    this.lockReason = null;
    this.recoveryRunIds = [];
    this.headChecksum = null;
    this.needsHeadRepair = false;
  }
  load() {
    let texts, head, ledger, ledgerText;
    try {
      texts = SAVE_KEYS.slots.map((key) => this.storage.getItem(key));
      const headText = this.storage.getItem(SAVE_KEYS.head);
      try { head = headText ? JSON.parse(headText) : null; } catch { head = null; }
      ledgerText = this.storage.getItem(SAVE_KEYS.terminal);
      ledger = parseTerminals(ledgerText);
    } catch (error) {
      this.locked = true;
      this.lockReason = ledgerText ? "ledger" : "storage";
      try { if (JSON.parse(ledgerText || "null")?.version > SAVE_VERSION) this.lockReason = "future"; } catch { /* Damaged ledger can only restore permanent progress. */ }
      if (containsFutureSave(texts)) this.lockReason = "future";
      this.recoveryRunIds = (texts || []).map(parseEnvelope).filter(Boolean).map((entry) => identity(entry.data.run)).filter(validId);
      const legacy = loadData(this.storage);
      this.data = { profile: legacy.profile, settings: legacy.settings, run: null };
      if (this.lockReason === "ledger") {
        const candidates = (texts || []).map(parseEnvelope);
        let selected = Number.isInteger(head?.slot) && head.slot >= 0 && head.slot < 2 ? candidates[head.slot] : null;
        const validHead = selected && selected.revision === head.revision && selected.checksum === head.checksum;
        if (!validHead) selected = candidates.filter(Boolean).sort((a, b) => b.revision - a.revision)[0];
        if (selected) {
          this.slot = candidates.indexOf(selected); this.revision = selected.revision;
          this.headChecksum = selected.checksum; this.needsHeadRepair = !validHead;
          this.data = { ...clone(selected.data), run: null };
          this.terminals = this.data.profile.completedRuns.map((id) => ({ id, revision: 0, checksum: "profile" }));
        }
      }
      this.lastError = this.lockReason === "future" ? "The completed-run history belongs to a newer game version. Use that version to continue." : error.message || "Local saves are unavailable.";
      return { ...clone(this.data), revision: this.revision, recovered: false, failed: true, error: this.lastError, terminalRuns: this.terminals.map((entry) => entry.id) };
    }
    this.locked = false;
    this.lockReason = null;
    if (containsFutureSave(texts)) {
      this.locked = true;
      this.lockReason = "future";
      const legacy = loadData(this.storage);
      this.data = { profile: legacy.profile, settings: legacy.settings, run: null };
      this.lastError = "This save was created by a newer game version. Use that version to continue; these files have not been changed.";
      return { ...clone(this.data), revision: 0, recovered: false, failed: true, error: this.lastError, terminalRuns: ledger.map((entry) => entry.id) };
    }
    const candidates = texts.map(parseEnvelope);
    let selected = Number.isInteger(head?.slot) && head.slot >= 0 && head.slot < 2 ? candidates[head.slot] : null;
    const validHead = selected && selected.revision === head.revision && selected.checksum === head.checksum;
    if (!validHead) selected = candidates.filter(Boolean).sort((a, b) => b.revision - a.revision)[0] || null;
    // The terminal receipt is the commit point for a death. Roll the matching
    // prepared transaction forward if its head write was interrupted.
    for (const candidate of candidates.filter(Boolean)) {
      const proof = ledger.find((entry) => entry.id === candidate.terminalRunId && entry.revision === candidate.revision && entry.checksum === candidate.checksum);
      if (proof && (!selected || candidate.revision > selected.revision)) selected = candidate;
    }
    this.terminals = ledger;
    if (selected) {
      this.slot = candidates.indexOf(selected);
      this.revision = selected.revision;
      this.headChecksum = selected.checksum;
      this.needsHeadRepair = !validHead || selected !== candidates[head.slot];
      this.data = clone(selected.data);
      this.terminals = mergeTerminals(ledger, this.data.profile.completedRuns.map((id) => ({ id, revision: 0, checksum: "profile" })));
      const deadRun = this.data.run && this.terminals.some((entry) => entry.id === identity(this.data.run));
      if (deadRun) this.data.run = null;
      const recovered = !validHead || selected !== candidates[head.slot] || !!deadRun;
      this.lastError = recovered ? "Recovered the last valid checkpoint. Ended runs cannot be resumed." : "";
      return { ...clone(this.data), revision: this.revision, recovered, failed: false, error: this.lastError, terminalRuns: this.terminals.map((entry) => entry.id) };
    }
    const legacy = loadData(this.storage);
    this.data = { profile: legacy.profile, settings: legacy.settings, run: null };
    const damaged = texts.some(Boolean) || !!head;
    this.lastError = damaged ? "Checkpoint data was damaged. Permanent progress was recovered from its compatibility copy; the interrupted run is unavailable." : legacy.failed ? "Some saved progress or settings could not be read." : "";
    return { ...clone(this.data), revision: 0, recovered: damaged, failed: legacy.failed || damaged, error: this.lastError, terminalRuns: ledger.map((entry) => entry.id) };
  }
  commit({ profile, settings, run = null, terminalRunId = null, terminalRunIds = [], repairLedger = false }) {
    if (!this.data) this.load();
    // An actual death/explicitly ended life remains ended in this window even
    // when storage is denied. Emergency exports and backup previews must not
    // revive it while the terminal transaction is waiting for a retry.
    if (validId(terminalRunId))
      this.terminals = mergeTerminals(this.terminals, [{ id: terminalRunId, revision: 0, checksum: "memory" }]);
    const repairing = repairLedger && this.locked && this.lockReason === "ledger";
    if (this.locked && !repairing) return { ok: false, error: this.lastError || "Local saves are unavailable.", revision: this.revision };
    let durableTerminal = false;
    try {
      let latestHead;
      try { latestHead = JSON.parse(this.storage.getItem(SAVE_KEYS.head) || "null"); } catch { latestHead = null; }
      if (Number.isInteger(latestHead?.slot) && latestHead.slot >= 0 && latestHead.slot < 2) {
        const current = parseEnvelope(this.storage.getItem(SAVE_KEYS.slots[latestHead.slot]));
        if (current && current.revision === latestHead.revision && current.checksum === latestHead.checksum &&
          (current.revision > this.revision || (current.revision === this.revision && this.headChecksum && current.checksum !== this.headChecksum)))
          throw Error("Another game window updated this save. Return to the title screen and reload before saving again.");
      }
      if (this.needsHeadRepair && this.revision > 0) {
        this.storage.setItem(SAVE_KEYS.head, JSON.stringify({ slot: this.slot, revision: this.revision, checksum: this.headChecksum }));
        this.needsHeadRepair = false;
      }
      const ledger = mergeTerminals(this.terminals, repairing ? [] : parseTerminals(this.storage.getItem(SAVE_KEYS.terminal)));
      const data = normalizeData({ profile, settings, run });
      if (!Array.isArray(terminalRunIds) || terminalRunIds.some((id) => !validId(id)) || (terminalRunId !== null && !validId(terminalRunId)))
        throw Error("Invalid completed-run identity.");
      const endedIds = unique([...(terminalRunId ? [terminalRunId] : []), ...terminalRunIds]);
      if (data.run && this.data.run && identity(data.run) === identity(this.data.run)) {
        data.profile.activeFindClaims = unique([...this.data.profile.activeFindClaims, ...data.profile.activeFindClaims]);
        if (data.profile.activeFindClaims.length > MAX_ACTIVE_CLAIMS) throw Error("This expedition exceeds the supported reward-history budget.");
      }
      if (data.run && (ledger.some((entry) => entry.id === identity(data.run)) || endedIds.includes(identity(data.run))))
        throw Error("This run has ended and cannot be saved as a living character.");
      data.profile.completedRuns = unique([...data.profile.completedRuns, ...endedIds]).slice(-8192);
      const revision = this.revision + 1, slot = 1 - this.slot;
      const body = { version: SAVE_VERSION, revision, savedAt: Date.now(), terminalRunId: endedIds[0] || null, data };
      const envelope = { ...body, checksum: saveChecksum(JSON.stringify(body)) };
      const text = JSON.stringify(envelope);
      if (text.length > MAX_SAVE_BYTES) throw Error("This checkpoint exceeds the offline save size budget.");
      this.storage.setItem(SAVE_KEYS.slots[slot], text);
      const check = parseEnvelope(this.storage.getItem(SAVE_KEYS.slots[slot]));
      if (!check || check.checksum !== envelope.checksum || check.revision !== revision) throw Error("The checkpoint could not be verified after writing.");
      if (endedIds.length || repairing) {
        const entries = mergeTerminals(ledger, endedIds.map((id) => ({ id, revision, checksum: envelope.checksum })));
        const terminalText = JSON.stringify({ version: SAVE_VERSION, entries, checksum: saveChecksum(JSON.stringify(entries)) });
        this.storage.setItem(SAVE_KEYS.terminal, terminalText);
        const verified = parseTerminals(this.storage.getItem(SAVE_KEYS.terminal));
        const verifiedIds = new Set(verified.filter((entry) => entry.revision === revision && entry.checksum === envelope.checksum).map((entry) => entry.id));
        if (endedIds.some((id) => !verifiedIds.has(id)))
          throw Error("The completed-run record could not be verified.");
        this.terminals = entries;
        durableTerminal = endedIds.length > 0;
      } else this.terminals = ledger;
      try {
        this.storage.setItem(SAVE_KEYS.head, JSON.stringify({ slot, revision, checksum: envelope.checksum }));
        this.needsHeadRepair = false;
      } catch (error) {
        if (!durableTerminal) throw error;
        this.needsHeadRepair = true;
        // Recovery can finish this terminal commit using its verified receipt.
      }
      this.slot = slot;
      this.revision = revision;
      this.headChecksum = envelope.checksum;
      this.data = clone(data);
      this.lastError = "";
      this.locked = false; this.lockReason = null; this.recoveryRunIds = [];
      // Legacy keys are compatibility mirrors, not competing sources of truth.
      // Their failure cannot undo a successfully committed journal transaction.
      try {
        this.storage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
        this.storage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      } catch { /* The verified journal remains authoritative. */ }
      return { ok: true, revision, error: "" };
    } catch (error) {
      this.lastError = error.message || "The checkpoint could not be saved.";
      return { ok: false, revision: this.revision, error: this.lastError };
    }
  }
  exportBackup(currentData) {
    if (!this.data) this.load();
    const data = currentData ? normalizeData(currentData) : clone(this.data);
    const body = { format: BACKUP_FORMAT, version: SAVE_VERSION, createdAt: new Date().toISOString(), data, terminalRuns: this.terminals.map((entry) => entry.id) };
    return JSON.stringify({ ...body, checksum: saveChecksum(JSON.stringify(body)) }, null, 2);
  }
  previewBackup(text) {
    try {
      if (typeof text !== "string" || text.length > MAX_SAVE_BYTES) throw Error("Choose a valid Jurassic Domination backup smaller than 20 MB.");
      const backup = JSON.parse(text), { checksum, ...body } = backup;
      if (body.format !== BACKUP_FORMAT || body.version !== SAVE_VERSION || saveChecksum(JSON.stringify(body)) !== checksum)
        throw Error("This backup is incompatible, incomplete or damaged.");
      const data = normalizeData(body.data);
      if (!Array.isArray(body.terminalRuns) || body.terminalRuns.some((id) => !validId(id))) throw Error("The backup has an invalid completed-run ledger.");
      if (!this.data) this.load();
      const repairLedger = this.locked && this.lockReason === "ledger";
      if (this.locked && !repairLedger) throw Error(this.lastError || "Local saves are unavailable.");
      const terminalIds = new Set([...this.terminals.map((entry) => entry.id), ...this.data.profile.completedRuns, ...body.terminalRuns, ...data.profile.completedRuns]);
      const warnings = [];
      const sameLivingRun = data.run && this.data.run && identity(data.run) === identity(this.data.run);
      if (sameLivingRun) {
        data.profile.activeFindClaims = unique([...data.profile.activeFindClaims, ...this.data.profile.activeFindClaims]);
        if (data.profile.activeFindClaims.length > MAX_ACTIVE_CLAIMS) throw Error("This expedition exceeds the supported reward-history budget.");
      }
      if (repairLedger) {
        for (const id of [...this.recoveryRunIds, identity(data.run)].filter(validId)) terminalIds.add(id);
        data.run = null;
        warnings.push("The completed-run history is damaged. This import repairs permanent progress only; active lives are excluded to preserve permadeath.");
      } else if (data.run && terminalIds.has(identity(data.run))) {
        data.run = null;
        warnings.push("This life has already ended on this device. Only permanent progress can be restored.");
      }
      if (this.data.run && identity(this.data.run) !== identity(data.run)) {
        terminalIds.add(identity(this.data.run));
        warnings.push("Importing this backup replaces your current expedition. That previous life will no longer be resumable.");
      }
      if (!data.run) data.profile.activeFindClaims = [];
      // A backup may restore a previous balance but cannot reissue permanent
      // receipt rewards already claimed on this device.
      data.profile.claimedFinds = unique([...data.profile.claimedFinds, ...this.data.profile.claimedFinds]).slice(-2048);
      data.profile.claimedAchievements = unique([...data.profile.claimedAchievements, ...this.data.profile.claimedAchievements]);
      data.profile.ancestry = mergeAncestry(data.profile.ancestry, this.data.profile.ancestry);
      data.profile.completedRuns = unique([...data.profile.completedRuns, ...this.data.profile.completedRuns, ...terminalIds]).slice(-8192);
      return { ok: true, data, terminalRuns: [...terminalIds], warnings, repairLedger, error: "" };
    } catch (error) { return { ok: false, error: error.message || "The backup could not be read." }; }
  }
  importBackup(text) {
    const preview = this.previewBackup(text);
    if (!preview.ok) return preview;
    // The incoming bundle is verified in the inactive slot before retiring
    // replaced lives, using the same transaction as a normal death checkpoint.
    const result = this.commit({ ...preview.data, terminalRunIds: preview.terminalRuns, repairLedger: preview.repairLedger });
    return result.ok ? { ...result, data: clone(this.data), warnings: preview.warnings } : result;
  }
}
