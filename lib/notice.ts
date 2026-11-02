// For notices a page shows from its address after a redirect (e.g. ?taken=… or ?removed=…).
import "server-only";

/**
 * A new value each time the page is rendered on the server. Passed as a <Toast> trigger, a
 * notice closed earlier on this page slides down again after the next redirect, even when the
 * address is the same as before (the same time taken twice, "Too many attempts" again).
 */
export function renderId() {
  return crypto.randomUUID();
}
