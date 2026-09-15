import { useState, type RefObject } from "react"
import { CompanyWorkspaceDemo } from "./CompanyWorkspaceDemo"
import { AnnualElectricityWorksheet } from "./AnnualElectricityWorksheet"
import { AnnualElectricityEvidence } from "./AnnualElectricityEvidence"
import { SourceElectricityWorksheet } from "./SourceElectricityWorksheet"
import { ElectricityWorksheet } from "./ElectricityWorksheet"
import { CorporateCoverageRegister } from "./CorporateCoverageRegister"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"

export function StagingWorkspace({ headingRef, staging }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null } }) {
  const [panel, setPanel] = useState<"corporate" | "evidence" | "annual" | "source" | "worksheet" | "example">("corporate")
  return <>
    <nav className="worksheet-nav" aria-label="Workspace views">
      <button type="button" aria-pressed={panel === "corporate"} onClick={() => setPanel("corporate")}>Corporate coverage</button>
      <button type="button" aria-pressed={panel === "evidence"} onClick={() => setPanel("evidence")}>Annual electricity and bills</button>
      <button type="button" aria-pressed={panel === "annual"} onClick={() => setPanel("annual")}>Full-year electricity</button>
      <button type="button" aria-pressed={panel === "source"} onClick={() => setPanel("source")}>Bill-linked worksheet</button>
      <button type="button" aria-pressed={panel === "worksheet"} onClick={() => setPanel("worksheet")}>Electricity worksheet</button>
      <button type="button" aria-pressed={panel === "example"} onClick={() => setPanel("example")}>Saved example report</button>
    </nav>
    {panel === "corporate" && <CorporateCoverageRegister key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "evidence" && <AnnualElectricityEvidence actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onEntries={() => setPanel("annual")} />}
    <div hidden={panel !== "annual"}><AnnualElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "source"}><SourceElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "worksheet"}><ElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "example"}><CompanyWorkspaceDemo headingRef={headingRef} staging={staging} /></div>
  </>
}
