# Offline source catalog

`build_catalog.py` combines explicit source manifests into a deterministic integrity catalog. It reads local files, checks SHA-256 and declared byte lengths, and records the original metadata declarations and manifest hashes. It never downloads, calls a model, loads credentials, writes an index, selects a latest version, or approves a source for answers/calculations.

Python **3.10+**, standard library only. Originals remain outside Git. The output contains local paths and research metadata, not original document contents; treat it as an internal artifact.

## Run

From the repository root, with Python on PATH:

```powershell
python tools/research/build_catalog.py --manifest docs/research/downloaded-sources.json --manifest docs/research/california-downloads.json --manifest docs/research/calculation-extra-downloads.json --source-root "C:/Users/nimab/Neuvetra/research-sources/2026-09-08" --output docs/research/source-catalog.json
```

Supply additional refresh manifests with another `--manifest`, and each explicitly approved local source directory with another `--source-root`. The output's parent directory must exist. The command exits `0` after a successful atomic replacement, or `1` for input/integrity/write errors. It validates every artifact before opening a temporary output file. Failed validation or replacement preserves an existing catalog; a successful write uses a temporary file in the destination directory followed by `os.replace`.

The shared desktop runtime can be invoked directly when Python is not on PATH:

```powershell
& "C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" tools/research/build_catalog.py --help
```

## Input contract

Accept either a JSON array or an object containing `sources[]`. The current three source manifests and the refresh manifests use the latter. A minimal entry is:

```json
{
  "sources": [
    {
      "id": "example-corporate-standard",
      "title": "Example corporate standard",
      "publisher": "Example publisher",
      "canonical_url": "https://example.org/standard.pdf",
      "local_path": "C:/approved-research/standard.pdf",
      "sha256": "REPLACE_WITH_THE_FILE_SHA256_64_HEX_CHARACTERS",
      "bytes": 12345,
      "version": "edition-1",
      "status": "downloaded",
      "review_status": "unreviewed",
      "retrieved_at": "2026-09-08T12:00:00Z"
    }
  ]
}
```

The example is a schema illustration, not a runnable source or real evidence.

- Required: `local_path`, `sha256`, and an HTTP(S) URL. URL precedence is `canonical_url`, `source_url`, `url`, then `final_url`; all supplied recognized fields remain in provenance. The selected URL is not independently authenticated or fetched. Scheme/host are lowercased; path, query, and fragment are preserved. Credentials and control characters in URLs are rejected.
- Optional file-size declarations: `bytes` or `size_bytes`. They must be nonnegative integers and agree if both are supplied. Actual byte size is always measured. `file` is a label, not a substitute for `local_path`.
- Optional version: `version`, falling back to `edition`. Supply strings; if both are present they must agree. A publisher edition and a retrieval snapshot are different concepts: record the chosen meaning in `version_kind`. The tool never derives a version or effective date from a filename, modification time, retrieval time, or content hash.
- Optional identity: `id` identifies an artifact series across versions. `source_id` can group a broader family when `id` is supplied; when `id` is absent, `source_id` serves as the identity checked for collisions. Without either, URL/version collision checks still apply.
- Metadata: title, publisher, document/publication date, status, review/legal status, jurisdiction, effective interval, reporting period, rights review, and declared runtime approval are preserved when supplied as strings. They are declarations, not validated legal or domain facts. `retrieved_at`, transport metadata, page counts, and legacy matches are retained in per-entry provenance.
- Missing metadata becomes `null` with applicable unresolved-field labels. Unknown statuses remain verbatim and receive `status:unrecognized`; they do not become approved or current. Even an input that says `released` or `runtime_approval: approved` produces `runtime_eligible: false` and `runtime_approval: not_evaluated`. Its approval declaration is retained separately for review.
- Unknown entry-field names are listed in `unmapped_fields`; their values are not silently promoted into the normalized schema. Top-level `checks`, `reused_artifacts`, and other sections are listed in manifest provenance but are not imported as verified source files. Referenced unchanged artifacts must also be supplied through their original manifest.

## Paths, duplicates, and conflicts

Local source paths must resolve to regular files inside at least one explicit approved root. Relative paths are resolved from the containing manifest's directory, never an implicit source folder. Directory traversal, similarly named sibling directories, and symlink/junction targets cannot escape the resolved roots. UNC/network paths, Windows device paths, alternate data streams, and drive-relative paths are rejected. Foreign Windows paths are rejected when running on another operating system. Input files must be locally mounted; this tool supplies no remote filesystem access or credentials.

Identical canonical URL/version/hash references merge into one catalog entry with all declared IDs, local paths, and manifest/entry provenance. `duplicate_reference_count` exposes the consolidation. Conflicting descriptive metadata is left unresolved with both declarations preserved, rather than choosing the last writer.

The same explicit ID/version pointing at another URL or hash is a fatal conflict. The same canonical URL/version claiming different bytes is also fatal, including when version is missing. Supply distinct explicit versions only when the source researcher has established the distinction; do not relabel a mismatch merely to bypass integrity review. Different explicit versions remain separate, even if the bytes happen to be identical. No version wins automatically.

The output cannot replace an input manifest or an original source, including existing hard-link aliases. SHA-256 checks detect disagreement with the manifest, not whether both manifest and source are trustworthy. Use a controlled local filesystem: this is not a sandbox against a hostile process concurrently replacing directories/files. It detects ordinary file changes during reading but does not lock the entire source tree or implement crash-proof storage guarantees.

## Determinism and tests

Output has sorted keys, sources, roots, input-manifest paths, and provenance. Reversing CLI manifest arguments produces identical bytes; repeated identical arguments are read once. There is no generated timestamp. Identical input bytes/paths yield identical output. Changing manifest bytes or moving the source/manifests deliberately changes recorded provenance, even if the underlying document text is unchanged.

```powershell
python -m unittest discover -s tools/research -p "test_*.py" -v
```

Tests use synthetic temporary files and no credentials/network. They cover file tampering, size/missing/hash failures, path traversal and sibling escapes, symlink escape where the OS permits creating one, multiple roots, legacy aliases, duplicate consolidation, conflicting IDs/URLs/versions, unknown statuses, metadata disagreement, deterministic output, input overwrite prevention, and preservation/cleanup after validation or atomic-replacement failure. A skipped symlink test means that specific OS behavior was not exercised.

This catalog is a foundation for a separately reviewed evidence release. It does not parse passages, verify claim support, evaluate source applicability, answer questions, or calculate emissions.
