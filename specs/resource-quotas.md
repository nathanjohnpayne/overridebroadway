---
spec_id: resource-quotas
title: Backend mutation and upload quotas
status: active
---

# Backend mutation and upload quotas

Public email and Google signup remain available. `functions/` contains the trusted callable mutation backend; its allocation and ownership checks cannot be bypassed through client SDK calls. The backend accepts only known collections, fences production deletion, and permanently reserves production IDs and retired room tokens.

The approved user limits are 20 productions, 200 investors and 20 scenarios per production, 100 file allocations totaling 500 MiB, and 60 mutation requests in any sliding 60-second window. Producer pools and deal rooms also have a finite 20-record bound per production. Requests are limited to 64 KiB. Allocation transactions serialize through one private quota document per user, including legacy allocations. Invalid mutation attempts consume the request budget after authentication and request-size validation.

Production reservations count toward the 20-production limit even after deletion. File reservations count toward both upload limits even after expiry, failure, replacement or deletion. This conservative allocation accounting prevents concurrent upload, deletion and replay from freeing quota prematurely. Reclamation requires a separate trusted reconciliation procedure; the client cannot release quota. This deliberately bounds permanent reservation metadata as well as live objects.

Each upload uses a server-generated unique path, a 15-minute reservation, an exact byte/type bound, and a create-only Storage rule. Replaying a reservation cannot overwrite an object. Direct client deletes are denied; backend deletes consume the mutation budget. File content-type declarations do not constitute malware scanning.

## Acceptance criteria

- [ ] Concurrent creation cannot exceed collection or file limits.
- [ ] Unauthenticated, cross-owner, direct SDK, expired, mismatched-size and replayed operations fail closed.
- [ ] Production deletion fences child writes before cleanup; retired identifiers cannot be reused.
- [ ] The 61st mutation inside a sliding minute is rejected, including after failed allocation attempts.
- [ ] Existing Storage allocation usage is reconciled before enabling the backend. No production migration is performed by this change.
