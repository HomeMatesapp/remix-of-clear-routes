// Start-screen gate — Increment 1.
//
// The start screen must never block a returning user: any existing draft,
// in-progress answers, or restored session result bypasses it. Kept as a
// pure function so the rule is unit-testable without mounting the page.
//
// Deliberate non-input: "answers are non-empty". Decision Profile prefill
// populates answers BEFORE the user starts as a convenience; a prefilled
// user on a new role has NOT started that role's check and SHOULD see the
// start screen. Genuine in-progress states are covered explicitly:
// restored session results set hasResult, and legacy progress or modular
// drafts set hadSavedProgress.

export interface StartScreenGateInput {
  /** Local progress/session hydration has finished. */
  hydrated: boolean;
  /** A result is already on screen (fresh or restored from session). */
  hasResult: boolean;
  /** A legacy in-progress answer set or a modular draft was found on load. */
  hadSavedProgress: boolean;
  /** The user clicked "Start Reality Check" this visit. */
  startAcknowledged: boolean;
}

export const shouldShowStartScreen = (input: StartScreenGateInput): boolean =>
  input.hydrated &&
  !input.hasResult &&
  !input.hadSavedProgress &&
  !input.startAcknowledged;
