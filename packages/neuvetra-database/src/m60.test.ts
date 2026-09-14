import {describe,expect,test} from "bun:test"
import {buildDraftInventoryReport,M60_PROFILE} from "./m60"
import {buildInventoryEvidenceArchive} from "./m59"
import {fixture} from "./m59.test"

describe("M60 deterministic draft report",()=>{
  test("is byte-identical and visibly preserves exact totals, provenance, and limits",async()=>{
    const pack=buildInventoryEvidenceArchive(await fixture()),expected={archiveSha256:pack.archiveSha256,manifestSha256:pack.manifestSha256,lineageRootSha256:pack.lineageRootSha256}
    const a=buildDraftInventoryReport(pack.archive,expected,"Synthetic Acme, Inc."),b=buildDraftInventoryReport(pack.archive,expected,"Synthetic Acme, Inc."),html=new TextDecoder().decode(a.report)
    expect(a.profile).toBe(M60_PROFILE);expect(a.reportSha256).toBe(b.reportSha256);expect(a.report).toEqual(b.report)
    expect(html).toContain("27165.4064643528 kg CO2e");expect(html).toContain("139.281000 MWh");expect(html).toContain("126.788000");expect(html).toContain("12.493000")
    expect(html).toContain("Incomplete bounded draft — unreleased.");expect(html).toContain("Market-based Scope 2, Scope 1, and Scope 3 are outside this draft.");expect(html).toContain(pack.archiveSha256)
    expect((html.match(/<tr><td>2023-/g)??[]).length).toBe(12);expect(html).toContain("synthetic_november_statement_unavailable; (12.765000 + 12.221000) / 2; basis 2023-09, 2023-10");expect(html).toContain("outside_operational_control_after_lease_end; no quantity; not counted")
    expect(html).toContain("M58 fixed fictional electricity register; SHA-256");expect(html).toContain("epa-egrid2023-r2-camx-total-output · eGRID2023-revision-2 · 195.0402888 kg CO2e/MWh");expect(html).toContain("epa-egrid2023-ar5-100-year · egrid2023-technical-guide-v1")
    expect(html).toContain("M57 predecessor decision");expect(html).toContain("M58 annual inventory decision");expect(html).toContain("bounded_synthetic_scope_reviewed");expect(html).toContain("bounded_annual_location_register_reviewed");expect(html).toContain("They are not assurance")
    expect(html).toContain("@page{margin:24mm 14mm 20mm}");expect(html).toContain("position:fixed");expect((html.match(/DRAFT · SYNTHETIC · INCOMPLETE · UNRELEASED \/ NOT ELIGIBLE · NO ASSURANCE · releaseEligible=false/g)??[]).length).toBe(2)
  })
  test("refuses tampering before rendering",async()=>{const pack=buildInventoryEvidenceArchive(await fixture()),bytes=pack.archive.slice();bytes[100]^=1;expect(()=>buildDraftInventoryReport(bytes,{archiveSha256:pack.archiveSha256},"Synthetic Acme, Inc.")).toThrow("Evidence pack integrity failed")})
})
