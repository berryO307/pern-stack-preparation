// Site24x7 RUM integration — scoped to what the beacon's public JS API
// (https://www.site24x7.com/help/apm/rum/custom-api.html) actually supports,
// verified before writing any of this rather than guessed at. Two real
// commands exist that are relevant here: `userId` (a single string
// identifier) and `captureException` (takes an Error, no metadata/tags
// argument). There is no custom-timing/custom-metric API and no arbitrary
// custom-attribute API — see the Step 5 report for what that means for
// "tag sessions by role" and "custom timing around the fetch/first paint".
// SPA route naming needs no code at all: the beacon detects route changes
// automatically via the History API, which react-router's BrowserRouter
// already drives.

export function setRumUserId(userId: string) {
  window.s247r?.("userId", userId);
}

export function endRumSession() {
  window.s247r?.("endSession");
}

export function reportRumError(message: string) {
  window.s247r?.("captureException", new Error(message));
}
