# M66 publication byte preservation â€” supplemental review

**PASS for the publication-only staged repair.** Root must verify the committed blobs and remote required checks before calling the repaired evidence publication complete. No application changes or additional product tests are involved.

Root found that publication `56cdbce` normalized the outer line endings of the three accepted M66 snapshot JSON files from CRLF to LF. Earlier QA correctly verified working-file bytes and embedded hashes, but that did not prove the bytes Git would publish. The recorded accepted raw hashes therefore did not match the published blobs. Preserve this first publication failure; do not relabel it a successful exact-byte publication.

QA independently read the three published blobs and compared them with the retained originals: every difference is outer CRLF-to-LF conversion; parsed JSON and embedded artifact text are unchanged. The application and the accepted snapshot contents are unchanged, but byte-bound evidence integrity still requires repair.

| Snapshot | Accepted original SHA256 | Initial56cdbce published SHA256 |
| --- | --- | --- |
| M66-CTO | `ff383e1a3306a8aa69793a44003040074bd95fac5101659eed75fc0afbaddaa3` | `050ead4d0a64bf9a6d7ab58d7344a7b6c167192fc5467b9a3f64f5240b3c50c3` |
| M66-ACCOUNTING | `66bf638f041e1b2cfbc0f99ba2f95c94aadb271b44022991c3d57ea17cf9e114` | `0c4461c624801207d7e7848621bd96bb3875d36faadb6c4dad68e56c5fbbc50f` |
| M66-QA | `7b85c4f4b6484dcd008c42652e64b670c512bc48029337f2bf19906137037287` | `9c3bf335a9d78d13ee2feaa249ad50901307ec480fbeab354ce219d2bad59639` |

The reviewed attributes repair adds only three exact snapshot paths with `-text whitespace=cr-at-eol`, after the general JSON text rules. These exceptions preserve the already accepted original bytes without broadening behavior for other files. `whitespace=cr-at-eol` recognizes CR in those deliberate line endings; it does not change the file contents. No snapshot content rewrite or change to the accepted hosted handoff/verification is required.

The reviewer is the reused independent M66 QA context with disclosed prior M63 authorship and no M66 product authorship. This publication-only review uses explicitly authorized read-only Git inspection; root owns staging, lesson changes, commits and pushes. No cloud call or new product test was performed. Actual compute/cost is unknown.

## Exact staged-byte gate

QA independently extracted binary bytes directly from the index using `git show :path`, without a PowerShell text pipeline. All three staged snapshot SHA256 values equal the accepted originals in the table above, and all three equal the retained working-file bytes. Cached attributes report `text: unset` for each exact path; the generic `eol: lf` attribute remains listed but does not normalize a file with text unset. The observed staged bytes, rather than inference from attributes alone, establish this repair.

Root reports that ordinary `git add` initially retained stat-cached entries after the attributes change. Root then used bounded `git add --renormalize` for only these three snapshots. QA did not perform staging; its independent index-byte check occurred after that refresh and agrees with `.superpowers/m66-index-repair.json`.

| Staged artifact | Git blob object ID | SHA256 of staged bytes |
| --- | --- | --- |
| `.gitattributes` | `d2ddebaeca63633b57d3cea582eb9bcd4e6bd02e` | `efc7c7ffa75f504771638e29efb129c831d9e7a4af0273be72a1aa3921393e18` |
| `operations/agent-improvement/lessons.json` | `b631600eb05a16f6a5b418eeaa2b99afc2c38092` | `111741965f0bdeb8fbdaa4a42adf212c775993e29f82a4d801578c8a71a50a6a` |
| `operations/agent-improvement/snapshots/M66-CTO.json` | `5d8da900ed6a546a046b6f4c35b52620886d6a92` | `ff383e1a3306a8aa69793a44003040074bd95fac5101659eed75fc0afbaddaa3` |
| `operations/agent-improvement/snapshots/M66-ACCOUNTING.json` | `d06cd567ac0a4cb3ab95b32abca1bb442eb74721` | `66bf638f041e1b2cfbc0f99ba2f95c94aadb271b44022991c3d57ea17cf9e114` |
| `operations/agent-improvement/snapshots/M66-QA.json` | `874d1f24a74defa82839dabc9bfd0df3f818d52b` | `7b85c4f4b6484dcd008c42652e64b670c512bc48029337f2bf19906137037287` |

The lessons file is ordinary normalized text: its working raw SHA256 is `84b2093b7d6a1df00bdbd44c14bc35edda3f4eed8887f222984c87ae76cbc08f`; the staged LF hash above is the publication binding. This new L02 binding supplements the earlier hosted handoff's historical lessons hash without rewriting that accepted report.

## CI outcome and process correction

Root's tool-observed outcome for initial `56cdbce` was five successful checks and a failure in **Role routing and evidence records**. This was an evidence-publication gate failure, not a failed application test. QA did not independently query cloud CI. That failed publication is retained as the original outcome; the repair's CI result is not yet known at this review.

L02 is appropriately extended to compare exact staged Git blobs before commit and exact committed blobs afterward against accepted hashes. It explicitly rejects filesystem-only validation as sufficient proof and requires narrow attributes where accepted bytes must be preserved. The changed staged lesson has no unrelated process changes and retains `adopted_pending_effectiveness`; no measured benefit, compute causation or financial metric is claimed.

The staged diff covers only attributes, L02 and restoration of the three original snapshot byte sequences. The product, hosted verification, original accepted handoff and embedded snapshot texts are unchanged. No additional application tests were warranted. Root may commit this reviewed repair and supplement, then independently verify committed and remote snapshot hashes plus the exact required checks. General board feedback and M66 native print feedback remain separate, unchanged gates.
