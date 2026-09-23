# M78 continuation 4: partial browser observation

Observed by `/root` on September 22, 2026, after the automated exercise closed with a timeout. This is a bounded browser observation, not acceptance of the failed exercise or full preservation/restart verification.

## Observed

- The user-authorized email-link sign-in succeeded in the in-app browser. The UI displayed “Private staging access verified.” Authentication links, codes and tokens are excluded from this record.
- The Scope 1 view loaded ten discovered source records, zero unresolved workflow findings and eleven release findings. The synthetic gross total displayed `126850.1763 kg CO2e`.
- The process view showed one reviewed version and two saved reports. The combined inventory showed version 1 awaiting review, version 2 reviewed and three saved reports.
- The reviewed inventory report opened through the UI with HTTP 200. Its report ID was `34e2d10c-dd83-4aa4-9342-5b8914d0bd81`; version ID `8f320e61-e91c-4de2-8443-ff62d08d5748`; report SHA256 `cb602a9424af7267a230b3701d5356d23a3fbd89bb383b7e31ba82865337bca2`. These match the verified application operation identities.
- The report metadata declared HTML SHA256 `9014825cda67f66ebe39f7a711ddc34e85f2c242ee4df2afc6d78bad419d4d8c`, HTML size 2,573,401 bytes, and snapshot SHA256 `ffc0bc58b166c2f426003f3dd0c6dc270971a3ecb058aef35dadb9db6db97b6e`.
- “Download evidence package” reread the retained report and then retrieved its snapshot with HTTP 200. The browser network response body exactly equaled the `snapshotJson` from the retained report. The raw body was not written to this document. The provider recorded 90,427 ms for this snapshot request, completing at `2026-09-22T23:58:32.170031700Z`.
- A screenshot showed distinct retained versions, three saved reports, both download controls and an embedded report preview. It did not establish print pagination or full report layout acceptance.
- “Download printable report” reread the retained report and retrieved its HTML with HTTP 200. The browser response body exactly equaled the retained report's `html`. Both download controls returned to their enabled state. The signed-in user tab was retained and the obsolete agent-created sign-in tab was closed.

## Outstanding

The complete preservation read, legacy read, independent actual recovery acceptance, print pagination and restart/revisit remain unaccepted at this observation. The original failed exercise is preserved unchanged. No inventory mutation, review or report creation was performed through the browser. No release, regulatory compliance or external assurance claim follows.

Provider observations: `m78-continuation4-failure-http-observation.json` and `m78-continuation4-browser-http-observation.json` in this directory. Slow successful responses and a 30-second client timeout establish an operational problem; they do not isolate its internal cause.
