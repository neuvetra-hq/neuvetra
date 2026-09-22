import { readM78Continuation4Diagnostics } from "../../tools/staging/check-m78-continuation4";

const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};

/** Additive read-only check for the escaped baseline-evaluator auth-method gap. */
export function verifyM78Continuation4BaselineAuthMethods(text: string) {
  const events = readM78Continuation4Diagnostics(text);
  let tokens = 0;
  let logouts = 0;
  for (const event of events) {
    check(event.mode === "baseline", "baseline diagnostics only");
    if (event.kind !== "request_intent") continue;
    if (event.data.route === "auth:/auth/v1/token") {
      check(event.data.method === "POST", "baseline login method");
      tokens += 1;
    } else if (event.data.route === "auth:/auth/v1/logout") {
      check(event.data.method === "POST", "baseline logout method");
      logouts += 1;
    }
  }
  check(tokens === 8 && logouts === 8, "baseline auth request counts");
  return { tokens, logouts, allAuthMethodsPost: true };
}
