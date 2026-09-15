/** Read-only closure check for the exact synthetic browser demonstration. */
import { parseJourneyInput } from "./check-hosted-journey"
import { decodeElectricityWorksheet } from "../../apps/site-web/src/lib/m64-api"
const HOST = "https://www.neuvetra.ai", AUTH = "https://icockcoguyadhryzydvl.supabase.co"
const expected = ["5dcba7105d521dbadb0602eddd76a394d4dff1215761eb2e1b1beb4e30c191b6", "cdce30bc93d3dbfd22be03468620b50e744f1497fb16cb8037326133f45e07e5", "0eb9943d9866ec5d9d143d83e223d8589451739094f7537337cd57a2279301c4"]
const results: unknown[] = []
let stage = "configuration"
try {
  const input = parseJourneyInput(JSON.parse(await Bun.stdin.text()))
  for (const role of ["manager1", "member"] as const) {
    const account = input.accounts.find(a => a.role === role)!
    let token: string | undefined
    try {
      stage = `sign_in_${role}`
      const auth = await fetch(AUTH + "/auth/v1/token?grant_type=password", { method: "POST", redirect: "error", headers: { apikey: input.env.SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(30000) })
      if (!auth.ok) throw new Error()
      const session = await auth.json() as { access_token: string; user: { id: string } }
      token = session.access_token
      if (session.user.id !== account.id) throw new Error()
      stage = `revisit_${role}`
      const response = await fetch(`${HOST}/workspace-api/workspace/${input.roster.workspaceId}/electricity-worksheet`, { redirect: "error", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error()
      const worksheet = decodeElectricityWorksheet(await response.json(), input.roster.workspaceId)
      if (worksheet.versions.length !== 3 || worksheet.versions.some((v, i) => v.resultSha256 !== expected[i]) || !worksheet.versions[0]?.review || !worksheet.versions[1]?.review || worksheet.versions[2]?.review !== null || worksheet.versions[2]?.total.display !== "36570.0542") throw new Error()
      results.push({ role, httpStatus: response.status, versions: worksheet.versions.map(v => ({ id: v.id, version: v.version, inputSha256: v.inputSha256, resultSha256: v.resultSha256, reviewSha256: v.review?.decisionSha256 ?? null, total: v.total })) })
    } finally {
      if (token) {
        const logout = await fetch(AUTH + "/auth/v1/logout?scope=local", { method: "POST", redirect: "error", headers: { apikey: input.env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
        if (logout.status !== 204) throw new Error()
      }
    }
  }
  const file = ".superpowers/m64-revisit.json"
  const previous = await Bun.file(file).exists() ? await Bun.file(file).json() : { attempts: [] }
  previous.attempts.push({ status: "pass", createdAt: new Date().toISOString(), applicationPostRequests: 0, realAuthSessionsClosed: true, results })
  await Bun.write(file, JSON.stringify(previous, null, 2) + "\n")
  console.log(JSON.stringify({ status: "m64_revisit_pass", applicationPostRequests: 0, realAuthSessionsClosed: true, results }))
} catch { console.log(JSON.stringify({ status: "m64_revisit_failed", stage })); process.exitCode = 1 }
