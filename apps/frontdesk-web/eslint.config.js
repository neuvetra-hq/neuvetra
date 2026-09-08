import { webConfig } from "../../config/eslint/web.mjs"

// Existing FrontDesk exceptions remain visible during incremental cleanup.
// These preserve the previous severity; new apps use the shared defaults.
export default webConfig({
  "@typescript-eslint/no-unused-vars": "warn",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-empty-object-type": "warn",
  "@typescript-eslint/ban-ts-comment": "warn",
  "no-empty": "warn",
  "no-prototype-builtins": "warn",
  "no-useless-escape": "warn",
  "react-hooks/exhaustive-deps": "warn",
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/immutability": "warn",
})
