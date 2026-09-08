"""Offline tests using synthetic files only. Run with unittest discovery."""

from contextlib import redirect_stderr
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from build_catalog import CatalogError, _local_path, build_catalog, canonical_json, main, write_catalog


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / "approved"
        self.root.mkdir()

    def source(self, name="source.txt", content=b"Original primary evidence", **fields):
        path = self.root / name
        path.write_bytes(content)
        return {
            "id": "source", "canonical_url": "https://example.org/source",
            "local_path": str(path), "sha256": hashlib.sha256(content).hexdigest(),
            "bytes": len(content), "publisher": "Example publisher", "title": "Example evidence",
            "status": "downloaded", "version": "edition-1", "review_status": "unreviewed",
            "document_date": "2026-01-01", "retrieved_at": "2026-09-08T12:00:00Z", **fields,
        }

    def manifest(self, records, name="manifest.json", wrapper=True):
        path = self.base / name
        data = {"sources": records, "checks": [{"note": "not a downloaded artifact"}]} if wrapper else records
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def build(self, *manifests):
        return build_catalog(list(manifests), [self.root])

    def test_integrity_metadata_and_legacy_aliases(self):
        row = self.source()
        row["source_url"] = row.pop("canonical_url")
        row["size_bytes"] = row.pop("bytes")
        row.pop("version")
        row.pop("publisher")
        catalog = self.build(self.manifest([row]))
        source = catalog["sources"][0]
        self.assertEqual(source["sha256"], row["sha256"])
        self.assertEqual(source["bytes"], row["size_bytes"])
        self.assertIsNone(source["version"])
        self.assertIsNone(source["publisher"])
        self.assertIn("version:not_declared", source["unresolved_fields"])
        self.assertIn("publisher:missing_or_conflicting", source["unresolved_fields"])
        self.assertFalse(source["runtime_eligible"])
        self.assertIn("checks", catalog["manifests"][0]["non_source_sections"])
        self.assertNotIn("effective_from", source["provenance"][0]["declared"])

    def test_tampered_content_is_rejected_even_when_size_matches(self):
        row = self.source(content=b"1234")
        manifest = self.manifest([row])
        Path(row["local_path"]).write_bytes(b"4321")
        with self.assertRaisesRegex(CatalogError, "SHA-256 mismatch"):
            self.build(manifest)

    def test_size_mismatch_missing_file_and_missing_hash_are_rejected(self):
        for mutation, message in (({"bytes": 1}, "Byte-size mismatch"), ({"sha256": None}, "sha256"),
                                  ({"local_path": str(self.root / "missing.pdf")}, "Missing")):
            with self.subTest(message=message):
                with self.assertRaisesRegex(CatalogError, message):
                    self.build(self.manifest([self.source(**mutation)]))

    def test_path_escape_and_prefix_sibling_are_rejected(self):
        sibling = self.base / "approved-other"
        sibling.mkdir()
        outside = sibling / "source.txt"
        outside.write_bytes(b"Original primary evidence")
        for path in (str(outside), "approved/../approved-other/source.txt"):
            with self.subTest(path=path):
                row = self.source(local_path=path)
                with self.assertRaisesRegex(CatalogError, "escapes"):
                    self.build(self.manifest([row]))

    def test_relative_path_inside_root_is_supported(self):
        row = self.source(local_path="approved/source.txt")
        result = self.build(self.manifest([row]))
        self.assertEqual(result["sources"][0]["local_paths"], [(self.root / "source.txt").as_posix()])

    def test_symlink_escape_is_rejected(self):
        target = self.base / "outside.txt"
        target.write_bytes(b"Original primary evidence")
        link = self.root / "link.txt"
        try:
            link.symlink_to(target)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable on this host: {error}")
        row = self.source(local_path=str(link))
        with self.assertRaisesRegex(CatalogError, "escapes"):
            self.build(self.manifest([row]))

    def test_network_and_alternate_stream_paths_are_rejected_without_opening(self):
        for path in (r"\\server\share\file.pdf", "//server/share/file.pdf", "approved/source.txt:secret"):
            with self.subTest(path=path):
                with self.assertRaises(CatalogError):
                    self.build(self.manifest([self.source(local_path=path)]))

    def test_mixed_separator_network_and_device_paths_never_reach_resolver(self):
        paths = (
            r"/\server/share/file.pdf",
            r"\/server/share/file.pdf",
            r"/\?\C:\file.pdf",
            r"\/.\C:\file.pdf",
        )
        for path in paths:
            for must_exist in (True, False):
                with self.subTest(path=path, must_exist=must_exist):
                    with patch("build_catalog.Path.resolve", side_effect=AssertionError("Network path reached resolver")) as resolve:
                        with self.assertRaisesRegex(CatalogError, "Network and device"):
                            _local_path(path, must_exist=must_exist)
                        resolve.assert_not_called()

    def test_exact_duplicate_references_merge_with_all_provenance(self):
        row = self.source()
        first = self.manifest([row], "first.json")
        second = self.manifest([{**row, "id": "alternate-id"}], "second.json", wrapper=False)
        catalog = self.build(first, second)
        self.assertEqual(len(catalog["sources"]), 1)
        source = catalog["sources"][0]
        self.assertEqual(source["declared_ids"], ["alternate-id", "source"])
        self.assertEqual(source["duplicate_reference_count"], 1)
        self.assertEqual(len(source["provenance"]), 2)

    def test_same_id_version_with_different_url_is_a_conflict(self):
        first = self.source()
        second = {**first, "canonical_url": "https://example.org/different"}
        with self.assertRaisesRegex(CatalogError, "Conflicting ID/version"):
            self.build(self.manifest([first, second]))

    def test_same_url_version_with_different_hash_is_a_conflict(self):
        first = self.source()
        second = self.source("new.txt", b"Changed evidence", id="different-id")
        with self.assertRaisesRegex(CatalogError, "Conflicting URL/version"):
            self.build(self.manifest([first, second]))

    def test_missing_versions_do_not_silently_select_latest(self):
        first = self.source(version=None)
        second = self.source("new.txt", b"Changed evidence", version=None, id="new")
        with self.assertRaisesRegex(CatalogError, "distinct explicit versions"):
            self.build(self.manifest([first, second]))

    def test_distinct_versions_are_retained_without_latest_flag(self):
        first = self.source()
        second = self.source("new.txt", b"Changed evidence", version="edition-2")
        result = self.build(self.manifest([second, first]))
        self.assertEqual([row["version"] for row in result["sources"]], ["edition-1", "edition-2"])
        self.assertNotIn("latest", canonical_json(result).decode())

    def test_unknown_status_and_declared_approval_do_not_approve_runtime(self):
        row = self.source(status="perfect-and-current", runtime_approval="approved")
        source = self.build(self.manifest([row]))["sources"][0]
        self.assertEqual(source["status"], "perfect-and-current")
        self.assertIn("status:unrecognized", source["unresolved_fields"])
        self.assertEqual(source["declared_runtime_approval"], "approved")
        self.assertEqual(source["runtime_approval"], "not_evaluated")
        self.assertFalse(source["runtime_eligible"])

    def test_duplicate_metadata_disagreement_is_visible_not_last_writer_wins(self):
        row = self.source()
        source = self.build(self.manifest([row, {**row, "publisher": "Different declaration"}]))["sources"][0]
        self.assertIsNone(source["publisher"])
        self.assertIn("publisher:conflicting_declarations", source["unresolved_fields"])
        self.assertEqual(len(source["provenance"]), 2)

    def test_output_is_byte_identical_across_manifest_argument_order(self):
        first = self.manifest([self.source()], "a.json")
        second = self.manifest([self.source("second.txt", b"Second", id="second", canonical_url="https://example.org/second")], "b.json")
        self.assertEqual(canonical_json(self.build(first, second)), canonical_json(self.build(second, first)))

    def test_validation_failure_preserves_previous_output(self):
        row = self.source()
        manifest = self.manifest([row])
        output = self.base / "catalog.json"
        output.write_bytes(b"previous catalog")
        Path(row["local_path"]).write_bytes(b"tampered")
        with redirect_stderr(io.StringIO()):
            result = main(["--manifest", str(manifest), "--source-root", str(self.root), "--output", str(output)])
        self.assertEqual(result, 1)
        self.assertEqual(output.read_bytes(), b"previous catalog")
        self.assertEqual(list(self.base.glob(".catalog.json.*.tmp")), [])

    def test_replace_failure_preserves_previous_output_and_removes_temporary(self):
        catalog = self.build(self.manifest([self.source()]))
        output = self.base / "catalog.json"
        output.write_bytes(b"previous catalog")
        with patch("build_catalog.os.replace", side_effect=OSError("simulated replacement failure")):
            with self.assertRaises(OSError):
                write_catalog(catalog, output)
        self.assertEqual(output.read_bytes(), b"previous catalog")
        self.assertEqual(list(self.base.glob(".catalog.json.*.tmp")), [])

    def test_successful_atomic_write_and_input_overwrite_guard(self):
        row = self.source()
        manifest = self.manifest([row])
        catalog = self.build(manifest)
        output = self.base / "catalog.json"
        write_catalog(catalog, output)
        self.assertEqual(output.read_bytes(), canonical_json(catalog))
        for protected in (manifest, Path(row["local_path"])):
            with self.subTest(path=protected):
                original = protected.read_bytes()
                with self.assertRaisesRegex(CatalogError, "must not replace"):
                    write_catalog(catalog, protected)
                self.assertEqual(protected.read_bytes(), original)

    def test_multiple_explicit_roots_and_required_roots(self):
        other = self.base / "other"
        other.mkdir()
        path = other / "source.txt"
        path.write_bytes(b"Original primary evidence")
        manifest = self.manifest([self.source(local_path=str(path))])
        self.assertEqual(len(build_catalog([manifest], [self.root, other])["sources"]), 1)
        with self.assertRaises(CatalogError):
            build_catalog([manifest], [])

    def test_duplicate_json_keys_and_disagreeing_version_aliases_rejected(self):
        manifest = self.base / "invalid.json"
        manifest.write_text('{"sources": [], "sources": []}', encoding="utf-8")
        with self.assertRaisesRegex(CatalogError, "Duplicate JSON key"):
            self.build(manifest)
        with self.assertRaisesRegex(CatalogError, "version and edition disagree"):
            self.build(self.manifest([self.source(edition="different-edition")]))


if __name__ == "__main__":
    unittest.main()
