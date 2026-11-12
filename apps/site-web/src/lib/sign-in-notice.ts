// WO-02: how the sign-in card shows a message. Shared by Landing (the visible notice, role="alert" for errors) and
// PrivateStaging (which leaves its polite live region empty for an error, so the error is announced once).
// WO-05a: the access-check texts are no longer about "private staging"; the session-ended text is the card's own body.
export function signInNoticeTone(message: string): "error" | "info" | null {
  if (!message || /^(Checking your access|Sign in with your invited|Workspace access verified|Your session ended)/.test(message)) return null
  return /fail|unavailable|could not|inactive|changed|Enter your/i.test(message) ? "error" : "info"
}

// Errors about what was typed mark the Email field invalid; service errors only move focus there (the email may be fine).
export const SIGN_IN_INPUT_ERROR = /^(Sign-in failed|Enter your)/
