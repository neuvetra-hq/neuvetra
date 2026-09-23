# M78 recovery2 restart actual independent review

## Verdict

**PASS for the single closed restart evidence chain.** The accepted recovery2 result, source-reviewed restart admission, durable request, exact provider acknowledgment, same-image startup, readiness receipt and sanitized startup log form one continuous hash-bound chain. This receipt does not authorize another restart.

The original collector was preserved after two read-only collection failures before either startup output existed. Those failures did not repeat the provider restart. The repaired collector `bbc03eba8ed216dbfca55b083a9de648790bb530eb98d1e55ad10918f6b0dddb` was separately frozen and source-reviewed. The actual startup receipt identifies that collector, while the original four helper pins in the pre-restart admission remain unchanged.

## Actual evidence

- Recovery2 acceptance: `eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1`.
- Restart admission: `bf5db0bcb6cd63672a40f2d74acc4ad497b9acc57d6ffd43e42481eb44eb7c89`, authorizing one restart and zero revisit application POSTs.
- Durable request: `3bd083fe23ea3ccf6e08b95c630d763be3a43a4469eb5aec25c904ddd9f81914`, reason `scope1_persistence_verification`, unique UUID, exact admission hash.
- Provider acknowledgment: `eaa08602067b1328c3f0b40421f6e80e3ebb97d0e96a93e253d0c587cb62f6a1`, exactly `{data:{deploymentRestart:true}}`.
- Startup receipt: `41bdf0c8eb25e38a7a3acdeab96dc9038217e7c698058b0c08757819a66aebc1` and sanitized log `08748798a46e3e25a8c6cc149b7ceda9ce2ba9a4b80a57f0fdf86281c8f58b38`.
- Exactly one unique post-request `staging_started` event was retained. The runtime is commit `9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e`, deployment `f6d77b2e-6886-429b-a4d2-4873c9199ce8`, image `sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b`, with `autodeploy:false`, ready schema 21 and legacy containment.

## Checks and limits

The actual checker rehashed all ten accepted recovery2 evidence files, the four original helper files, the repaired collector, every restart receipt and the sanitized log. It checked full chronology from recovery closure through admission observation, request, startup, collection and final observation. Synthetic adversarial tests passed 2 cases with 17 assertions, and a separate collector parser challenge covered flat, nested, duplicate, ambiguous and malformed rows. Strict targeted TypeScript passed.

The raw provider deployment list and autodeploy response are represented by hashes in the root-authored collector receipt; their bodies were not copied into this public review. No credentials, provider API, network, database, restart, or hosted application request was issued by the independent reviewer.
