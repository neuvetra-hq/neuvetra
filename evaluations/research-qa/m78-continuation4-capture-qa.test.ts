import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildM78Continuation4RevisitObservation,
  type M78CapturedObservation,
  type M78RevisitCaptureSet,
} from "../../tools/staging/m78-continuation4-revisit-capture";
import { m78CanonicalJson as canonical } from "../../packages/neuvetra-database/src/m78-validation";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

test("QA reconstructs actual-baseline-shaped maps through the real decoders", async () => {
  const journal = (await readFile(".superpowers/m78-hosted-continuation4.jsonl", "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  const baselineEvent = journal.find((event) => event.kind === "baseline")!;
  const company = baselineEvent.workspaceId as string;
  const root = `/workspace-api/workspace/${company}`;
  const observations = new Map<string, M78CapturedObservation>();
  const addJson = (route: string, json: unknown) => {
    const text = JSON.stringify(json);
    observations.set(route, { route, sha256: sha(text), byteLength: Buffer.byteLength(text), json });
  };
  const addBytes = (route: string) => {
    const value = `captured:${route}`;
    observations.set(route, { route, sha256: sha(value), byteLength: Buffer.byteLength(value) });
  };
  const addProof = (route: string) => addJson(route, { capturedProof: route });

  const { scope1, registers } = baselineEvent.data;
  addJson(`${root}/scope1-inventory`, scope1);
  for (const [family, base] of [
    ["corporate", "corporate-inventories"],
    ["gas", "stationary-natural-gas"],
    ["mobile", "mobile-diesel"],
    ["fleet", "controlled-fleet"],
    ["diesel", "stationary-diesel"],
    ["equipment", "stationary-equipment"],
    ["fugitive", "fugitive-sources"],
  ] as const) addJson(`${root}/${base}`, registers[family]);

  for (const version of registers.corporate.versions) {
    addBytes(`${root}/corporate-inventories/${version.inventoryId}/versions/${version.id}/coverage-export`);
  }
  for (const [family, base] of [
    ["gas", "stationary-natural-gas"],
    ["mobile", "mobile-diesel"],
    ["diesel", "stationary-diesel"],
  ] as const) {
    for (const worksheet of registers[family].worksheets) {
      for (const version of worksheet.versions) {
        addBytes(`${root}/${base}/${worksheet.worksheetId}/versions/${version.id}/calculation-export`);
        const statements = family === "mobile"
          ? [version.fuelStatement, version.mileageStatement]
          : [version.statement];
        for (const statement of statements) {
          if (statement) addBytes(`${root}/${base}/${worksheet.worksheetId}/statements/${statement.id}/download`);
        }
      }
      for (const report of worksheet.reports) {
        const reportRoot = `${root}/${base}/${worksheet.worksheetId}/reports/${report.id}`;
        addBytes(`${reportRoot}/download`);
        if (family === "diesel") addBytes(`${reportRoot}/snapshot`);
      }
    }
  }
  for (const [family, base] of [
    ["fleet", "controlled-fleet"],
    ["equipment", "stationary-equipment"],
  ] as const) {
    for (const version of registers[family].versions) {
      addBytes(`${root}/${base}/${version.rosterId}/versions/${version.id}/roster-export`);
      if (version.statement) addBytes(`${root}/${base}/${version.rosterId}/statements/${version.statement.id}/download`);
    }
    for (const report of registers[family].reports) {
      const reportRoot = `${root}/${base}/${report.rosterId}/reports/${report.id}`;
      addBytes(`${reportRoot}/download`);
      addBytes(`${reportRoot}/snapshot`);
      addProof(`${reportRoot}/proof`);
    }
  }
  for (const worksheet of [...registers.fugitive.worksheets, registers.fugitive.population]) {
    for (const version of worksheet.versions) {
      const base = version.family === "source" ? "fugitive-sources" : "fugitive-population";
      addBytes(`${root}/${base}/${version.streamId}/versions/${version.id}/calculation-export`);
      for (const statement of version.statements) {
        addBytes(`${root}/${base}/${version.streamId}/statements/${statement.id}/download`);
      }
    }
    for (const report of worksheet.reports) {
      const base = report.family === "source" ? "fugitive-sources" : "fugitive-population";
      const reportRoot = `${root}/${base}/${report.streamId}/reports/${report.id}`;
      addBytes(`${reportRoot}/download`);
      addBytes(`${reportRoot}/snapshot`);
    }
  }
  for (const [family, stream] of [
    ["process-screen", scope1.process],
    ["scope1-inventory", scope1.inventory],
  ] as const) {
    for (const version of stream.versions) {
      const base = `${root}/${family}/${version.streamId}`;
      addBytes(`${base}/versions/${version.id}/inventory-export`);
      for (const statement of version.statements) addBytes(`${base}/statements/${statement.id}/download`);
    }
    for (const report of stream.reports) {
      const base = `${root}/${family}/${report.streamId}/reports/${report.id}`;
      addBytes(`${base}/download`);
      addBytes(`${base}/snapshot`);
    }
  }

  const annualId = "10000000-0000-4000-8000-000000000001";
  const packId = "10000000-0000-4000-8000-000000000002";
  const reportId = "10000000-0000-4000-8000-000000000003";
  const billId = "10000000-0000-4000-8000-000000000004";
  addJson(root, { companyName: "Synthetic" });
  addJson(`${root}/bills/${billId}`, { id: billId });
  addJson(`${root}/inventories/2023/scope2`, { inventory: true });
  addJson(`${root}/annual-registers/2023`, { register: true });
  addJson(`${root}/annual-inventories/2023/scope2`, { id: annualId });
  const annualRoot = `${root}/annual-inventories/${annualId}`;
  addJson(`${annualRoot}/evidence-packs/current`, { id: packId });
  addJson(`${annualRoot}/draft-reports/current`, { id: reportId });
  addJson(`${annualRoot}/draft-reports/${reportId}/decisions/current`, { accepted: true });
  for (const [name, value] of [
    ["electricity-worksheet", { worksheet: 64 }],
    ["source-electricity-worksheet", { worksheet: 66 }],
    ["annual-electricity-worksheet", { worksheet: 67 }],
    ["annual-electricity-evidence", { evidence: 68 }],
  ] as const) addJson(`${root}/${name}`, value);
  addJson(`${root}/source-electricity-worksheet/sources`, { sources: [] });
  for (const base of [
    "electricity-worksheet",
    "source-electricity-worksheet",
    "annual-electricity-worksheet",
    "annual-electricity-evidence",
  ]) addJson(`${root}/${base}/reports`, { reports: [] });
  addBytes(`${annualRoot}/evidence-packs/${packId}/download`);
  addBytes(`${annualRoot}/draft-reports/${reportId}/download`);

  const captures: M78RevisitCaptureSet = {
    requests: observations.size,
    aggregateBytes: [...observations.values()].reduce((sum, item) => sum + item.byteLength, 0),
    observations,
  };
  const sourcePins = JSON.parse(
    await readFile("evaluations/research-qa/m78-continuation4-preparation-source-pins.json", "utf8"),
  );
  const result = await buildM78Continuation4RevisitObservation(captures, {
    workspaceId: company,
    journal: {
      path: ".superpowers/m78-hosted-continuation4.jsonl",
      sha256: sha(await readFile(".superpowers/m78-hosted-continuation4.jsonl")),
      head: journal.at(-1)!.sha256,
      events: journal.length,
    },
    gate: {
      path: ".superpowers/m78-continuation4-exercise-gate.json",
      sha256: "c".repeat(64),
    },
    journeyGate: { profile: "m78-root-continuation4-journey-gate-v1" },
    sourcePins,
    captureStartedAt: "2026-09-22T22:30:00.000Z",
    captureCompletedAt: "2026-09-22T22:31:00.000Z",
    observedAt: "2026-09-22T22:31:01.000Z",
  });

  expect(canonical(result.scope1)).toBe(canonical(scope1));
  expect(canonical(result.registers)).toBe(canonical(registers));
  expect(Object.keys(result.downloads).sort()).toEqual(Object.keys(baselineEvent.data.downloads).sort());
  for (const family of Object.keys(result.downloads)) {
    expect(Object.keys(result.downloads[family]!).sort(), family).toEqual(
      Object.keys(baselineEvent.data.downloads[family]!).sort(),
    );
  }
  expect(Object.keys(result.m78bytes).sort()).toEqual(Object.keys(baselineEvent.data.m78bytes).sort());
  expect(Object.keys(result.legacy.records)).toHaveLength(17);
  expect(result.capture).toMatchObject({
    requests: observations.size,
    uniqueRoutes: observations.size,
    authBodiesCaptured: 0,
    extraNetworkRequests: 0,
  });
});
