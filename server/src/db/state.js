const state = {
  ready: false,
  attempts: 0,
  initializedAt: null,
  lastError: null,
};

export function getDbState() {
  return { ...state };
}

export function markDbReady() {
  state.ready = true;
  state.initializedAt = new Date().toISOString();
  state.lastError = null;
}

export function markDbUnavailable(err) {
  state.ready = false;
  state.attempts += 1;
  state.lastError = err?.message || String(err);
}
