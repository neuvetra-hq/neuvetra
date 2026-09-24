import { Scope1Inventory } from "./Scope1Inventory"
import { StationaryEquipment } from "./StationaryEquipment"
import { StationaryGenerator } from "./StationaryGenerator"
import { FugitiveWorkpapers } from "./FugitiveWorkpapers"
import { useState, type RefObject } from "react"
import { CompanyWorkspaceDemo } from "./CompanyWorkspaceDemo"
import { AnnualElectricityWorksheet } from "./AnnualElectricityWorksheet"
import { AnnualElectricityEvidence } from "./AnnualElectricityEvidence"
import { SourceElectricityWorksheet } from "./SourceElectricityWorksheet"
import { ElectricityWorksheet } from "./ElectricityWorksheet"
import { CorporateCoverageRegister } from "./CorporateCoverageRegister"
import { StationaryNaturalGas } from "./StationaryNaturalGas"
import { MobileDiesel } from "./MobileDiesel"
import { ControlledFleet } from "./ControlledFleet"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"

type WorkspacePanel = "scope1" | "corporate" | "gas" | "generator" | "stationary" | "fugitive" | "mobile" | "fleet" | "evidence" | "annual" | "source" | "worksheet" | "example"

const sourceAndRegisterPanels: readonly WorkspacePanel[] = ["gas", "generator", "stationary", "mobile", "fleet", "fugitive"]
const continuityPanels: readonly WorkspacePanel[] = ["evidence", "annual", "source", "worksheet", "example"]

const panelLabels: Record<WorkspacePanel, string> = {
  scope1: "Scope 1 inventory",
  corporate: "Corporate coverage",
  gas: "Stationary natural gas",
  generator: "Stationary diesel generator",
  stationary: "Stationary equipment coverage",
  mobile: "Mobile diesel vehicles",
  fleet: "Fleet reconciliation",
  fugitive: "Refrigerants and fire suppression",
  evidence: "Annual electricity and bills",
  annual: "Full-year electricity",
  source: "Bill-linked worksheet",
  worksheet: "Electricity worksheet",
  example: "Saved example report",
}

export function StagingWorkspace({ headingRef, staging }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null } }) {
  const [panel, setPanel] = useState<WorkspacePanel>("scope1")
  const secondaryPanel = sourceAndRegisterPanels.includes(panel) || continuityPanels.includes(panel)
  return <>
    <nav className="worksheet-nav workspace-primary-nav" aria-label="Primary workspace views">
      <button type="button" aria-pressed={panel === "scope1"} onClick={() => setPanel("scope1")}>Scope 1 inventory</button>
      <button type="button" aria-pressed={panel === "corporate"} onClick={() => setPanel("corporate")}>Corporate coverage</button>
    </nav>
    <details className="workspace-secondary-nav">
      <summary>Other workspace views{secondaryPanel ? ` · Current: ${panelLabels[panel]}` : ""}</summary>
      <section aria-labelledby="scope1-sources-registers-heading">
        <h2 id="scope1-sources-registers-heading">Scope 1 sources and registers</h2>
        <nav className="worksheet-nav" aria-labelledby="scope1-sources-registers-heading">
        {sourceAndRegisterPanels.map(id => <button type="button" key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>{panelLabels[id]}</button>)}
        </nav>
      </section>
      <section aria-labelledby="electricity-examples-heading">
        <h2 id="electricity-examples-heading">Electricity and examples</h2>
        <nav className="worksheet-nav" aria-labelledby="electricity-examples-heading">
        {continuityPanels.map(id => <button type="button" key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>{panelLabels[id]}</button>)}
        </nav>
      </section>
    </details>
    {panel === "corporate" && <CorporateCoverageRegister key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "scope1" && <Scope1Inventory actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "gas" && <StationaryNaturalGas key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "generator" && <StationaryGenerator key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "stationary" && <StationaryEquipment key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onNavigate={setPanel} />}
    {panel === "mobile" && <MobileDiesel key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "fleet" && <ControlledFleet key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onNavigate={setPanel} />}
    {panel === "fugitive" && <FugitiveWorkpapers actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "evidence" && <AnnualElectricityEvidence actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onEntries={() => setPanel("annual")} />}
    <div hidden={panel !== "annual"}><AnnualElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "source"}><SourceElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "worksheet"}><ElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "example"}><CompanyWorkspaceDemo headingRef={headingRef} staging={staging} /></div>
  </>
}
