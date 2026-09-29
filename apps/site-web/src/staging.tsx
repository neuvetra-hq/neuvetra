import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./staging.css"
import "./journey.css"
import { PrivateStaging } from "./components/PrivateStaging"

createRoot(document.getElementById("root")!).render(<StrictMode><PrivateStaging /></StrictMode>)
