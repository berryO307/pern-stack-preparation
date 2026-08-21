// Site24x7 RUM integration — scoped to what the beacon's public JS API
// actually supports, verified before writing any of this rather than
// guessed at. Two reference pages exist and disagree with each other:
// https://www.site24x7.com/help/apm/rum/custom-api.html lists 12 commands
// (userId, addBreadCrumbs, captureException, endCurrentSession, etc.) but
// omits the event-tracking pair below entirely; those instead appear only
// on https://www.site24x7.com/help/apm/rum/events.html, documented as
// `s247r('trackEvents', true)` + `s247r('addEvent', <event_type>)`, with no
// support for duration or metadata on an event — just a name, counted by
// occurrence. Implemented anyway since it's independently corroborated
// (search results describing the same syntax) and low-risk either way: an
// unrecognized command is a silent no-op for this beacon, same as every
// other call here already assumes via `?.`.
//
// `endCurrentSession` is the real command name — an earlier version of this
// file called `endSession`, which doesn't exist in either reference and was
// silently doing nothing.
//
// SPA route naming needs no code at all: the beacon detects route changes
// automatically via the History API, which react-router's BrowserRouter
// already drives.

let eventsEnabled = false;

function ensureEventsEnabled() {
  if (eventsEnabled) return;
  window.s247r?.("trackEvents", true);
  eventsEnabled = true;
}

export function setRumUserId(userId: string) {
  window.s247r?.("userId", userId);
}

export function endRumSession() {
  window.s247r?.("endCurrentSession");
}

export function reportRumError(message: string) {
  window.s247r?.("captureException", new Error(message));
}

// Discrete named occurrence only — no duration, no metadata, the API
// doesn't support either. Callers that want to convey "how long something
// took" have no honest way to do that through this beacon; don't add a
// second argument here expecting it to do anything.
export function trackRumEvent(eventType: string) {
  ensureEventsEnabled();
  window.s247r?.("addEvent", eventType);
}
