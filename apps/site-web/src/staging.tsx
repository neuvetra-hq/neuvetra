import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./staging.css"
import "./journey.css"
import "./spend-import.css"
import { PrivateStaging } from "./components/PrivateStaging"
import { SlowRequestNotice } from "./components/SlowRequestNotice"
import { configureSharedGets } from "./lib/shared-get"

// Round 3 lane C (PR-3): screens opened together (journey status, Activity, its panels) share identical reads for 2 s.
configureSharedGets({ ttlMs: 2_000 })
createRoot(document.getElementById("root")!).render(<StrictMode><PrivateStaging /><SlowRequestNotice /></StrictMode>)
