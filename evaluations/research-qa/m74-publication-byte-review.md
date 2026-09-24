# M74 publication byte review

The coordinator inspected final staging differences after independent local acceptance. Git normalization would have changed the independently recorded security manifest's CRLF bytes; a precise `.gitattributes` rule preserves them. The new PowerShell recovery helper also has an exact-byte rule to avoid future checkout conversion. Neither change alters executable behavior.

Removed one redundant blank line at end of the new backend fixture to satisfy the whitespace check. The earlier accepted snapshot preserves the pre-cleanup text; the sole delta is the final empty line. All product/calculation/migration/operator bytes remain unchanged. Final staging is checked byte-for-byte against the working tree before commit.

Attribution clarification: S01 was repaired by the original operator author `/root/m73_accounting` under root coordination, then independently accepted by `/root/m74_cto`. The security report's “Root repaired” wording refers to the coordinated work; root did not author that repair.

Remote required checks and actual hosted transition are still pending; local acceptance is not milestone completion.

First remote records check failed because coordinator-authored evidence references used Windows backslashes. These mutable run/status references were normalized to repository-relative forward slashes; accepted artifact bytes and product code were unchanged. The failed check is preserved in CI history. Local validation is rerun and a fresh remote check is required.

Second remote failure was the historical M73 operator test expecting admission under the newer17 manifest. The frozen operator correctly refuses it. The test now checks refusal before database access for both old target versions; older manifest branches remain independently challenged. No M73 operator implementation or M74 product code changed. See m74-legacy-operator-ci-review.md.
