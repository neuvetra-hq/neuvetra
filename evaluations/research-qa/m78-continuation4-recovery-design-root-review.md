# Root review: read-only recovery design

Root accepts design candidate 3 for implementation planning only. Author: `/root/m78_transport_continuation`; reviewer: `/root`, who did not author the design document. Snapshot SHA256: `225607d820d7357d23d66adae923853837177d4090e648f71c0c765b0d0f5f51`; document SHA256: `d399a5d00c9b0f472661b3d205d9f0ef60c54846c8e2e7291ba1c7c4a9ed343f`.

The design preserves the failed exercise, permits no replay of application writes, requires exact baseline-plus-37-operation state proof and separates a recovered outcome from a successful exercise. It requires independent evidence acceptance before a new restart/revisit path. Historical source pins and fresh runtime pins have distinct validation paths.

Root's first substantive review identified four corrections: only the inventory successor is reviewed; the 2,573,401-byte measurement describes HTML; historical pins cannot be compared with a changed working tree; and preservation must permit only the specifically recorded review/head changes while keeping prior immutable records intact. Candidate 3 addresses all four. Earlier candidates remain retained.

The next admitted task is a local read-only GET performance probe. The design does not approve a source patch, deployment, hosted recovery, restart or release, and is not evidence that those operations succeeded. Executable candidates require their own independent review and applicable checks.
