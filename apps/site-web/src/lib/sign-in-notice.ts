// WO-02: how the sign-in card shows a message. Shared by Landing (the visible notice, role="alert" for errors) and
// PrivateStaging (which leaves its polite live region empty for an error, so the error is announced once).
export function signInNoticeTone(message: string): "error" | "info" | null {
  if (!message || /^(Checking private staging|Sign in with your invited|Private staging access verified)/.test(message)) return null
  return /fail|unavailable|could not|inactive|changed|Enter your/i.test(message) ? "error" : "info"
}

// Errors about what was typed mark the Email field invalid; service errors only move focus there (the email may be fine).
export const SIGN_IN_INPUT_ERROR = /^(Sign-in failed|Enter your)/
