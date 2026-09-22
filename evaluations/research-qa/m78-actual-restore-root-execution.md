# M78 actual encrypted restore — root execution

The original readonly hosted backup succeeded September17 05:06UTC. Archive SHA7460b387b521644c16d4553fc1db1f176335766a05fcd4ac947443d77a65f145, plaintext snapshot SHA bd11fa7d9b759c70a249abfd013fc971e8f24f1e7586b5460a643d5ba20d9200, original backup journal SHA54ab59711c68eca841b4a894526bd200ae482364cdcabcee834ba6ccc0bc5648 are preserved. No plaintext archive was written.

Original clone m78_ops_actual20_20260917 and failure journals remain unchanged. ACT-R01 repair candidate1 was independently accepted in m78-application-transfer-review.md. Root checked all115 current source hashes against pinned map6f1897f36e773e4d612a1b128bce32e56069cf3b966eb968b9ee490a86e064c9 and verified original archive/backup journal bytes before executing.

A sandbox attempt for target b stopped at Windows unprotect, before the local restore function or local journal creation. Its two-event hosted journal remains preserved. A fresh target c with new journals ran using the Windows account needed by the existing CurrentUser encryption; automatic approval allowed this local recovery. It completed successfully without touching the hosted database.

Successful fresh clone: m78_ops_actual20_20260917c, local PostgreSQL55472. Original local restore journal SHA351c2bc3e376a988edfb6d014c9e21b50ba91bfe61129e0b5f61a47e00b9fd26; hosted provenance journal SHAab8c7cae9ad5d5b767f88d5893fe0d4c8fa30be7d5c702309416b33df3f07c8a. Terminal statuses are m78_local_application_restored and m78_hosted_snapshot_restored_locally. All113 application tables passed exact comparison. The latter retains full original inventory and explicitly records27 excluded unrelated-schema default ACL rows. This is application recovery only.

Independent actual semantic recovery review remains pending. Clone c is retained for read-only review; a separate original-archive clone will be used for the exact recipe rehearsal after admission. No M78 hosted migration/deployment, actual38-write recipe or Scope1 release completion is claimed.
