import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { M78_CONTINUATION3_PATHS } from "../../tools/staging/check-m78-continuation3";
import { M78_CONTINUATION4_PATHS } from "../../tools/staging/check-m78-continuation4";

const wrapper = ".superpowers/m78-private-continuation4-journey.ps1";
const preflight = ".superpowers/m78-continuation4-preflight.ts";
const observer = ".superpowers/m78-continuation4-refresh-runtime.py";
const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

async function put(root: string, path: string, bytes: string | Uint8Array) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

test("private wrapper preserves exact gates before its only credential unseal", async () => {
  const [w, p, o] = await Promise.all([
    readFile(wrapper, "utf8"),
    readFile(preflight, "utf8"),
    readFile(observer, "utf8"),
  ]);
  expect(sha(w)).toBe("3cef7393da74fb2b670a4c847409c2c87f9a30ad04c6b9cca92be30707026abe");
  expect(sha(p)).toBe("d27b1cc0fe15ba55494461485dc00c55b57b2a7a44f055983209f388e67aeae9");
  expect(sha(o)).toBe("47f9cadd43320d333a37e5995be6dc72d9385c2b149a38c1529311f57bf5554f");
  const predecessor = await readFile(".superpowers/m78-continuation3-refresh-runtime.py", "utf8");
  expect(o).toBe(predecessor.replaceAll("m78-continuation3-", "m78-continuation4-"));

  const unseal = w.indexOf("[Security.Cryptography.ProtectedData]::Unprotect");
  expect(unseal).toBeGreaterThan(0);
  for (const required of [
    "complete source closure changed",
    "reviewed closure mismatch",
    "missing original outcome evidence",
    "wrong disposition path",
    "stale runtime",
    "sha256='d27b1cc0fe15ba55494461485dc00c55b57b2a7a44f055983209f388e67aeae9'",
    "$preflightProcess.WaitForExit()",
    "$preflightProcess.ExitCode -ne 0 -or $preflightOutput.Result.Trim() -cne 'verified'",
  ]) {
    expect(w.indexOf(required)).toBeGreaterThan(0);
    expect(w.indexOf(required)).toBeLessThan(unseal);
  }
  expect(w.match(/::Unprotect/g)).toHaveLength(1);
  expect(w).toContain("$review.evidencePins.Count -ne 9");
  expect(w).toContain("tools/staging/m78-continuation4-source-pins.ts");
  expect(w).toContain("tools/staging/check-m78-continuation4.ts");
  expect(w).toContain(".superpowers/m78-continuation3-cleanup-disposition.json");
  expect(w).toContain("-NotePropertyName interruptionDisposition -NotePropertyValue $dispositionPin -Force");
  expect(p).toContain("verifyM78Continuation3Disposition(input,{read})");
  expect(p).toContain("verifyM78Continuation4PriorFailure(");
  expect(p).not.toMatch(/password|Unprotect|fetch\(/);
});

test("private preflight accepts exact prior failure and cleanup only, using temporary mocked inputs", async () => {
  const executable = resolve(preflight);
  const sources = {
    interruptedMain: await readFile("tools/staging/m78-continuation3-interrupted-main.jsonl", "utf8"),
    interruptedDiagnostics: await readFile(
      "tools/staging/m78-continuation3-interrupted-diagnostics.jsonl",
      "utf8",
    ),
    failedMain: await readFile(M78_CONTINUATION4_PATHS.failedMain, "utf8"),
    failedDiagnostics: await readFile(M78_CONTINUATION4_PATHS.failedDiagnostics, "utf8"),
    failedReview: await readFile(M78_CONTINUATION4_PATHS.failedReview, "utf8"),
    disposition: await readFile(M78_CONTINUATION3_PATHS.disposition, "utf8"),
  };
  const receipt = JSON.parse(sources.disposition) as {
    evidencePins: Array<{ path: string; sha256: string }>;
  };
  const evidence = await Promise.all(
    receipt.evidencePins.map(async (pin) => ({ ...pin, bytes: await readFile(pin.path) })),
  );
  const dispositionPin = {
    path: M78_CONTINUATION3_PATHS.disposition,
    sha256: sha(sources.disposition),
  };

  const cases: Array<{
    name: string;
    mutate?: (root: string) => Promise<void>;
    accepted: boolean;
  }> = [
    { name: "accepted_exact_inputs", accepted: true },
    {
      name: "changed_actual_main",
      accepted: false,
      mutate: async (root) =>
        put(root, ".superpowers/m78-hosted-continuation3.jsonl", `${sources.failedMain} `),
    },
    {
      name: "changed_public_main",
      accepted: false,
      mutate: async (root) => put(root, M78_CONTINUATION4_PATHS.failedMain, `${sources.failedMain} `),
    },
    {
      name: "changed_actual_diagnostics",
      accepted: false,
      mutate: async (root) =>
        put(
          root,
          ".superpowers/m78-hosted-continuation3-diagnostics.jsonl",
          `${sources.failedDiagnostics} `,
        ),
    },
    {
      name: "changed_public_diagnostics",
      accepted: false,
      mutate: async (root) =>
        put(root, M78_CONTINUATION4_PATHS.failedDiagnostics, `${sources.failedDiagnostics} `),
    },
    {
      name: "changed_review",
      accepted: false,
      mutate: async (root) => put(root, M78_CONTINUATION4_PATHS.failedReview, `${sources.failedReview} `),
    },
    {
      name: "changed_cleanup_receipt",
      accepted: false,
      mutate: async (root) => put(root, M78_CONTINUATION3_PATHS.disposition, `${sources.disposition} `),
    },
    {
      name: "missing_cleanup_evidence",
      accepted: false,
      mutate: async (root) =>
        rm(join(root, evidence[0]!.path), { force: true }),
    },
  ];

  for (const entry of cases) {
    const directory = await mkdtemp(join(tmpdir(), "neuvetra-m78-continuation4-preflight-"));
    try {
      await put(directory, M78_CONTINUATION3_PATHS.interrupted, sources.interruptedMain);
      await put(directory, M78_CONTINUATION3_PATHS.interruptedDiagnostics, sources.interruptedDiagnostics);
      await put(directory, ".superpowers/m78-hosted-continuation3.jsonl", sources.failedMain);
      await put(
        directory,
        ".superpowers/m78-hosted-continuation3-diagnostics.jsonl",
        sources.failedDiagnostics,
      );
      await put(directory, M78_CONTINUATION4_PATHS.failedMain, sources.failedMain);
      await put(directory, M78_CONTINUATION4_PATHS.failedDiagnostics, sources.failedDiagnostics);
      await put(directory, M78_CONTINUATION4_PATHS.failedReview, sources.failedReview);
      await put(directory, M78_CONTINUATION3_PATHS.disposition, sources.disposition);
      for (const pin of evidence) await put(directory, pin.path, pin.bytes);
      if (entry.mutate) await entry.mutate(directory);

      const child = Bun.spawn([process.execPath, executable], {
        cwd: directory,
        stdin: new TextEncoder().encode(JSON.stringify(dispositionPin)),
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exit, out, err] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exit, entry.name).toBe(entry.accepted ? 0 : 1);
      expect(out.trim(), entry.name).toBe(entry.accepted ? "verified" : "refused");
      expect(err, entry.name).toBe("");
      expect(await Bun.file(join(directory, M78_CONTINUATION4_PATHS.journal)).exists()).toBeFalse();
      expect(await Bun.file(join(directory, M78_CONTINUATION4_PATHS.diagnostics)).exists()).toBeFalse();
    } finally {
      const target = resolve(directory);
      const temporaryRoot = resolve(tmpdir());
      if (!target.startsWith(`${temporaryRoot}\\`) && !target.startsWith(`${temporaryRoot}/`)) {
        throw new Error("Unsafe temporary cleanup");
      }
      await rm(target, { recursive: true, force: true });
    }
  }
});
