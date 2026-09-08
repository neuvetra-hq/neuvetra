"""Build an offline integrity catalog; never approve evidence or choose a latest version."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PureWindowsPath
import re
import stat
import sys
import tempfile
from typing import Any
from urllib.parse import urlsplit, urlunsplit


class CatalogError(ValueError):
    """An input cannot safely and unambiguously enter the integrity catalog."""


METADATA = (
    "title", "publisher", "status", "review_status", "legal_status", "document_date",
    "publication_date", "effective_from", "effective_to", "reporting_period",
    "jurisdiction", "rights_review", "runtime_approval", "version_kind",
)
DECLARED_FIELDS = set(METADATA) | {
    "id", "source_id", "version", "edition", "canonical_url", "source_url", "url",
    "final_url", "file", "local_path", "sha256", "bytes", "size_bytes", "retrieved_at",
    "content_type", "last_modified", "content_verified", "pages", "legacy_exact_matches",
}
KNOWN_STATUSES = {
    "downloaded", "retrieved", "retained", "unreviewed", "parsed", "reviewed",
    "released", "superseded", "withdrawn", "draft", "unknown",
}


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise CatalogError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise CatalogError(f"Invalid JSON constant: {value}")


def _text(record: dict[str, Any], name: str) -> str | None:
    value = record.get(name)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise CatalogError(f"{name} must be a nonempty string when supplied")
    return value.strip()


def _local_path(raw: str, base: Path | None = None, *, must_exist: bool = True) -> Path:
    # Refuse UNC/device paths before resolve(), which could contact a network share.
    if raw.startswith(("\\\\", "//")):
        raise CatalogError("Network and device paths are not permitted")
    windows_path = PureWindowsPath(raw)
    if windows_path.drive.startswith("\\\\"):
        raise CatalogError("Network and device paths are not permitted")
    if windows_path.drive and (os.name != "nt" or not windows_path.is_absolute()):
        raise CatalogError("Foreign or drive-relative Windows path is not permitted")
    tail = raw[len(windows_path.drive):]
    if ":" in tail:
        raise CatalogError("Alternate data streams and URI paths are not permitted")
    path = Path(raw)
    if not path.is_absolute():
        path = (base or Path.cwd()) / path
    try:
        return path.resolve(strict=must_exist)
    except (OSError, RuntimeError) as error:
        raise CatalogError(f"Missing or unresolvable local path: {path}") from error


def _url(record: dict[str, Any]) -> str:
    value = next((_text(record, key) for key in ("canonical_url", "source_url", "url", "final_url") if record.get(key) is not None), None)
    if value is None or any(ord(char) < 33 for char in value):
        raise CatalogError("A canonical_url, source_url, url, or final_url is required")
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
            raise CatalogError("Source URL must be an HTTP(S) URL without credentials")
        _ = parsed.port  # Validate malformed ports without making a request.
    except ValueError as error:
        raise CatalogError("Malformed source URL") from error
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path, parsed.query, parsed.fragment))


def _verify_file(record: dict[str, Any], manifest: Path, roots: list[Path]) -> tuple[Path, str, int]:
    raw_path = _text(record, "local_path")
    if raw_path is None:
        raise CatalogError("local_path is required; a file label alone is not a path")
    path = _local_path(raw_path, manifest.parent)
    if not any(path.is_relative_to(root) for root in roots):
        raise CatalogError(f"Source path escapes the approved roots: {path}")
    if not path.is_file():
        raise CatalogError(f"Source must be a regular file: {path}")
    digest = _text(record, "sha256")
    if digest is None or re.fullmatch(r"[a-fA-F0-9]{64}", digest) is None:
        raise CatalogError("sha256 must contain exactly 64 hexadecimal characters")
    sizes = [record[key] for key in ("bytes", "size_bytes") if key in record]
    if any(type(size) is not int or size < 0 for size in sizes) or len(set(sizes)) > 1:
        raise CatalogError("bytes/size_bytes must be matching nonnegative integers")
    try:
        with path.open("rb") as source:
            before = os.fstat(source.fileno())
            if not stat.S_ISREG(before.st_mode):
                raise CatalogError(f"Source must be a regular file: {path}")
            hasher = hashlib.sha256()
            size = 0
            while chunk := source.read(1024 * 1024):
                size += len(chunk)
                hasher.update(chunk)
            after = os.fstat(source.fileno())
    except OSError as error:
        raise CatalogError(f"Cannot read source file: {path}") from error
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or size != after.st_size:
        raise CatalogError(f"Source changed during verification: {path}")
    if sizes and sizes[0] != size:
        raise CatalogError(f"Byte-size mismatch: {path}")
    if hasher.hexdigest() != digest.lower():
        raise CatalogError(f"SHA-256 mismatch: {path}")
    return path, digest.lower(), size


def build_catalog(manifests: list[Path], source_roots: list[Path]) -> dict[str, Any]:
    """Validate all inputs before returning a deterministic, unapproved catalog."""
    if not manifests or not source_roots:
        raise CatalogError("At least one manifest and one approved source root are required")
    roots = sorted({_local_path(str(root)) for root in source_roots}, key=str)
    if any(not root.is_dir() for root in roots):
        raise CatalogError("Approved source roots must be existing directories")
    manifest_paths = sorted({_local_path(str(path)) for path in manifests}, key=str)
    manifest_records: list[dict[str, Any]] = []
    groups: dict[tuple[str, str | None, str], list[dict[str, Any]]] = {}
    ids: dict[tuple[str, str | None], tuple[str, str]] = {}
    urls: dict[tuple[str, str | None], str] = {}
    for manifest in manifest_paths:
        try:
            raw = manifest.read_bytes()
            data = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_object,
                              parse_constant=_invalid_constant)
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise CatalogError(f"Cannot read JSON manifest: {manifest}") from error
        records = data.get("sources") if isinstance(data, dict) else data
        if not isinstance(records, list):
            raise CatalogError(f"Manifest must be an array or an object with sources[]: {manifest}")
        manifest_hash = hashlib.sha256(raw).hexdigest()
        manifest_records.append({
            "path": manifest.as_posix(), "sha256": manifest_hash, "source_count": len(records),
            "non_source_sections": sorted(key for key in data if key != "sources") if isinstance(data, dict) else [],
        })
        for index, record in enumerate(records):
            try:
                if not isinstance(record, dict):
                    raise CatalogError("Source entry must be an object")
                url = _url(record)
                version = _text(record, "version") or _text(record, "edition")
                if record.get("version") and record.get("edition") and record["version"] != record["edition"]:
                    raise CatalogError("version and edition disagree; choose one explicit version")
                declared_id = _text(record, "id")
                source_id = _text(record, "source_id")
                path, digest, size = _verify_file(record, manifest, roots)
                identity = (url, digest)
                identity_id = declared_id or source_id
                if identity_id:
                    id_key = (identity_id, version)
                    if id_key in ids and ids[id_key] != identity:
                        raise CatalogError(f"Conflicting ID/version: {identity_id!r}, {version!r}")
                    ids[id_key] = identity
                url_key = (url, version)
                if url_key in urls and urls[url_key] != digest:
                    raise CatalogError("Conflicting URL/version bytes; supply distinct explicit versions")
                urls[url_key] = digest
                metadata = {key: _text(record, key) for key in METADATA}
                groups.setdefault((url, version, digest), []).append({
                    "id": declared_id, "source_id": source_id, "path": path.as_posix(), "bytes": size,
                    "metadata": metadata,
                    "origin": {"manifest": manifest.as_posix(), "manifest_sha256": manifest_hash,
                               "entry_index": index, "declared": {key: record[key] for key in sorted(DECLARED_FIELDS & record.keys())},
                               "unmapped_fields": sorted(record.keys() - DECLARED_FIELDS)},
                })
            except CatalogError as error:
                raise CatalogError(f"{manifest.name} sources[{index}]: {error}") from error
    sources = []
    for (url, version, digest), references in groups.items():
        unresolved = ["runtime_approval:not_evaluated"]
        metadata: dict[str, Any] = {}
        for key in METADATA:
            values = sorted({reference["metadata"][key] for reference in references if reference["metadata"][key] is not None})
            metadata[key] = values[0] if len(values) == 1 else None
            if len(values) > 1:
                unresolved.append(f"{key}:conflicting_declarations")
        for key in ("publisher", "title", "status", "document_date", "review_status"):
            if metadata[key] is None:
                unresolved.append(f"{key}:missing_or_conflicting")
        if metadata["status"] is not None and metadata["status"] not in KNOWN_STATUSES:
            unresolved.append("status:unrecognized")
        if version is None:
            unresolved.append("version:not_declared")
        if not all(reference["origin"]["declared"].get("retrieved_at") for reference in references):
            unresolved.append("retrieved_at:missing")
        if any(reference["origin"]["unmapped_fields"] for reference in references):
            unresolved.append("metadata:unmapped_fields")
        # Content identities are mechanical; a version label is never derived from a filename/date.
        catalog_id = hashlib.sha256(canonical_json([url, version, digest])).hexdigest()
        metadata["declared_runtime_approval"] = metadata.pop("runtime_approval")
        sources.append({
            "catalog_id": catalog_id, "canonical_url": url, "version": version,
            "sha256": digest, "bytes": references[0]["bytes"], **metadata,
            "declared_ids": sorted({ref["id"] for ref in references if ref["id"]}),
            "source_ids": sorted({ref["source_id"] for ref in references if ref["source_id"]}),
            "local_paths": sorted({ref["path"] for ref in references}),
            "duplicate_reference_count": len(references) - 1,
            "runtime_eligible": False, "runtime_approval": "not_evaluated",
            "unresolved_fields": sorted(set(unresolved)),
            "provenance": sorted((ref["origin"] for ref in references), key=lambda item: (item["manifest"], item["entry_index"])),
        })
    return {
        "schema_version": 1, "purpose": "Offline integrity catalog; not an approved runtime evidence release",
        "runtime_eligible": False, "approved_source_roots": [root.as_posix() for root in roots],
        "manifests": manifest_records,
        "sources": sorted(sources, key=lambda source: (source["canonical_url"], source["version"] or "", source["sha256"])),
    }


def write_catalog(catalog: dict[str, Any], output: Path) -> None:
    """Replace output only after successful serialization and a complete same-directory write."""
    output = _local_path(str(output), must_exist=False)
    protected = [Path(item["path"]) for item in catalog["manifests"]]
    protected += [Path(path) for source in catalog["sources"] for path in source["local_paths"]]
    resolved_output = output.resolve()
    for path in protected:
        if resolved_output == path.resolve() or (output.exists() and os.path.samefile(output, path)):
            raise CatalogError("Output must not replace an input manifest or original source")
    payload = canonical_json(catalog)
    temporary: str | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", prefix=f".{output.name}.", suffix=".tmp", dir=output.parent, delete=False) as handle:
            temporary = handle.name
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output)
        temporary = None
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", action="append", required=True, type=Path, help="Explicit JSON manifest; repeat for multiple inputs")
    parser.add_argument("--source-root", action="append", required=True, type=Path, help="Approved existing local source directory; repeat as needed")
    parser.add_argument("--output", required=True, type=Path, help="Catalog file; parent directory must already exist")
    args = parser.parse_args(argv)
    try:
        catalog = build_catalog(args.manifest, args.source_root)
        write_catalog(catalog, args.output)
    except (CatalogError, OSError, ValueError) as error:
        print(f"Catalog not written: {error}", file=sys.stderr)
        return 1
    print(f"Wrote {len(catalog['sources'])} integrity-checked artifacts; runtime approval remains unevaluated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
