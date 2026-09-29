import { expect, test } from "bun:test"
import { createScope2Engine } from "../calculation/scope2-authority"
import { lookupCollectionZip } from "./collection-zip"

test("collection ZIP picker agrees with the reviewed Scope 2 lookup on single and multiple subregions", async () => {
  const engineFile = new URL("../calculation/scope2_engine.py", import.meta.url)
  const expectedEngineSha256 = new Bun.CryptoHasher("sha256").update(await Bun.file(engineFile).bytes()).digest("hex")
  const engine = createScope2Engine({ python: process.env.NEUVETRA_PYTHON ?? "python", expectedEngineSha256 })
  for (const zip of ["94105", "07401"]) {
    expect(await lookupCollectionZip(zip)).toEqual(await engine.lookupZip(zip))
  }
})
