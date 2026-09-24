# V3 exact-session cleanup: independent native and source review

M78-INTERRUPTED-SESSION-CLEANUP-V3-REVIEW-01. Reviewer /root/resume_release; root author. Accept exact V3 source20b6a58f409925b8a9c29982a85585cbfc4361e48c75301ebffe8a00c1b602a3 and wrappere807cfac23d5b0834db3896e7c7ec046333e413dc8cd137f5a9ff99738166cfa for the bounded four-session operation. No hosted cleanup executed by reviewer.

## Driver finding and actual evidence

Installed postgres3.4.9 src/types.js:31 converts parameters inferred as timestamptz through Date.toISOString(), even when the input is raw text. This discards sub-millisecond precision. V2 retained server text but allowed that serializer to round it, so my prior mocked source test missed the real driver boundary. The earlier acceptance and failed host attempt remain preserved as an escaped review defect, not rewritten as success.

Actual diagnosticd983 completed its read-only guards: SELECT/DELETE privileges true, two expected cascade FKs, no custom triggers,61 sessions and121 application tables. All four selected created/updated raw timestamps contain sub-millisecond fractions (.40455,.67552,.854837,.000115), and original exact comparisons are false. The suppressed V2 exception/stage remains unknown; driver rounding is a reproducible zero-row mechanism for these exact timestamp values and strongly explains the failure, not a recovered original error message.

Independently executed a new TEMP-only native PostgreSQL test through the actual application driver on existing loopback55472 local clone. Four synthetic fixture rows use these timestamp values; an unrelated fifth row is retained. Old inferred-timestamptz predicates delete0, text→timestamptz predicates delete4, wrong-subject predicates delete0, unrelated row remains exact. A savepoint rollback restores all5 rows. Temporary table drops at transaction commit. No persistent or auth tables modified, no hosted calls. This independently challenges the real driver boundary rather than substituting mocked timestamp equality.

## V3 source boundaries

Diff from V2 preserves fixed4570 four identities, ISO no-drift admission, raw before/after timestamp projection, serializable transaction, exact incoming cascade/no-custom-trigger guards, each DELETE returning1, selected linked-row absence and nonselected/full application inventory preservation. Only parameter typing changes to $3::text::timestamptz and $4::text::timestamptz, so the driver preserves raw timestamp text while PostgreSQL compares exact timestamp values.

V3 additionally binds the old failed intent30aa, postobserverbab and diagnosticd983 before DB access; new exclusive V3 intent/result/failure filenames preserve all prior evidence. Safe stage labels/SQLSTATE and commitReturned are added. A caught error with commitReturned:false is still classified failed_or_uncertain, not guaranteed rollback if commit acknowledgment was lost. Receipt-write failure after returned commit records commitReturned:true. Preconnect failures remain outside catch; no mutation is inferred. Never reset the new intent to retry.

Wrapper exact hash verified; it pins V3 script before narrow secret access, uses fixed argument and hidden stdin/withheld stderr as before. Underlying imported guards remain independently admitted. No privilege grants, alternate-user logout, broad cleanup, schema/application writes or repeated inventory save introduced. Nonselected/app assertions remain transaction-snapshot comparisons, not observations of unrelated concurrent commits.

Source admission is not actual disposition. Root must execute once and return actual commit/result or failure evidence, then obtain independent postcondition review. Token usability remains not_verified, expiryVerified:false. Original lost JWT strings/expiry were not observed. Own native probe/result/report/source receipt/run/snapshot only. Requested inherited gpt-6-astra/high; actual settings unobservable.
