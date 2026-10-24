# Agent Login implementation guidance

This document is informative. It suggests implementation techniques and review scenarios for the
[core specification](agent-login-core.md) and [Relay profile](relay-profile.md); it adds no conformance
requirements. Protocol outcomes remain defined by those documents. Storage layout, coordination and
recovery mechanisms are implementation choices.

## State and coordination

Use immutable Agent and enrollment identities independently of handles and public-key thumbprints. A
handle can be reassigned; a key can acquire a new enrollment after expiry. Capture the authorised identity
before asynchronous work and check the same identity when applying its effects. The distinction also
protects delegated management authority from transferring to a replacement Agent.

Constraints can enforce one unexpired active enrollment per public key, one Account per Agent/client pair and one
code per transaction. Scope unproved pending records to their Agent; claim global exclusivity only after proof
verification, so a caller knowing a public key cannot reserve it against its holder. These constraints complement
the authorization checks: a unique code alone does not prove that
its Agent remained enabled or that signup admission succeeded.

Deleting an expired pending challenge also needs a conditional check: the enrollment may have become active
since it was read. Check that it is still pending when deleting, rather than relying on the earlier status.

Group assertion acceptance with challenge consumption, identity binding, gate decisions and the
transaction's quota reservation. Group completion with its code, Account changes, count and reservation
release. Keep a reservation tied to the transaction that owns it; a losing request has no reservation of
its own to release. Multiple live transactions for one Agent share one quota place, so deleting one claim
does not necessarily free capacity.

Coordinate admission for the same Owner/client pair even before an Account exists. Database transactions,
conditional writes and serializable execution are possible approaches. If explicit locks are used, use a
consistent order. Limit unrelated pairs' contention where possible. A mutex inside one process does not
coordinate another process serving the same Issuer.

Lifecycle versions or retained invalidation records can distinguish an uninterrupted enabled state from
disable followed by re-enable. Check authoritative state during assertion, completion, redemption, issuance
and UserInfo authorization. An earlier positive cache entry or lagging replica may omit an acknowledged
revocation. Perform network requests and costly cryptographic work outside database transactions where
possible, then revalidate the relevant identities and lifecycle state before applying the result.

## Time, retries and uncertain outcomes

Use a consistent time source across serving instances. Read fresh time after coordination waits and on
each retry: transaction-start timestamps can already be stale when a lock is acquired. Apply the core's
expiry comparisons at the authorization decision, including a wait during which no row changed. Compute
effective transaction status from the original event times; polling and cleanup are poor clocks for expiry.
Token Claims and stored validity should describe the same issuance event.

Retry a confirmed rollback with fresh preconditions and a bounded retry budget. A lost commit response is
different: the mutation might have succeeded. Reconcile against durable evidence identifying that exact
operation, such as transaction identity and version, enrollment identity, code/token hash or a targeted
redemption marker. Finding a row with a reused handle is not sufficient evidence. A general operation
journal is one option, not a prerequisite.

If the outcome cannot be established, return a server error without inventing success or starting another
issuance. Reconciliation does not make a protocol single-use operation repeatable; a client retry of a
successfully redeemed code remains a replay. Keep replay evidence through any in-progress token issuance
and the validity of the credentials that replay handling can revoke. Check client, redirect and PKCE
bindings before applying replay side effects.

## Retention and confidential data

Clean up expired transient records in bounded batches. Retention depends on relationships: an expired
key may still explain a retained transaction's terminal outcome, and a used code may still be needed for
replay handling. Compact history only after identifying which dependent decisions still need it. Signup
counts remain separate from deletable Accounts for the period specified by core Section 7.6.

One-way digests suit bearer credentials and code/token values needed only for equality checks. A continue
secret or upstream Access Token needed for later delivery cannot be recovered from a digest; authenticated
encryption with separately managed keys is one approach. Include backups and diagnostic output in the
confidentiality boundary. Avoid logging secrets through request URLs, error details or database parameters.

Owner email linkage retained for deleted-Owner quota accounting remains sensitive even when stored as a
hash. Address comparison, mailbox reassignment and deletion timing affect who inherits a retained count.
Implement the published retention rule consistently; do not imply that a finite deletion period preserves
an unlimited historical cap. Limit access to linkage data and separate it from data disclosed to Relying
Parties.

## Backup restoration

Restoring an earlier database can undo revocations, disables, deletions, consumed callback state, consent
withdrawals and signup accounting. Treat restoration as a security recovery exercise before serving
requests. Reconcile invalidations acknowledged after the backup or invalidate affected authority and
require fresh enrollment and sign-in. This includes Owner and Delegated Credentials, Agent Keys,
transactions, codes and Access Tokens; rotating the Issuer signing key alone does not repair them.

When history cannot be recovered, keep uncertain identities, grants and affected admissions unavailable
until their state can be established. Fresh enrollment is not evidence that an old deleted Agent still
exists. For an RP, discarding pending login states on restoration prevents a consumed state restored from a
backup from authorizing another exchange. Test restoration with a deliberately older backup, rather than
only checking that records can be loaded.

## Adversarial review scenarios

These scenarios supplement boundary tests; they are not additional normative requirements.

- Pause enrollment or management after authorization; delete the Agent and recreate its handle under the same or a different Owner. Resume and verify that the old request and Delegated Credential cannot mutate the replacement.
- Pause proof, update or revocation after reading an enrollment; expire or remove it, create a permitted new enrollment, then resume. Verify that the new enrollment is unaffected. Race enrollment of the same key across different handles.
- Hold coordination across proof, assertion, transaction or code expiry, including a lock holder that changes no data. Repeat with a confirmed rollback and retry. Verify expiry is checked at the final authorization decision.
- Lose the connection before and after commit, then restart. Check that reconciliation distinguishes the exact committed operation from a later occupant of its natural key; it never produces a second code, token set, Account or count.
- Inspect secret storage, logs and backups. Restore a snapshot predating revocation, deletion and consent withdrawal. Verify that recovery does not revive authority or erase counts still within their retention period.
- Delete expired records while dependent transactions, codes or tokens remain. Check that cleanup preserves the evidence needed for invalidation, replay, terminal retention and quota decisions.

Other useful schedules cover duplicate assertions under cap one; two transactions for one Agent with one
expiring; completion racing disable and re-enable; and revocation after a transaction's retention ends.
Check the original terminal outcome and count as well as credential rejection.

For consent, race acceptance from different material metadata snapshots and distinguish absent from
present fields. A scope accepted under old terms is not evidence of acceptance under new terms. For Owner
approval, test each authentication, provisioning and recovery path with an Agent able to read the Owner's
mail. An authentication-method label alone does not establish independence.

Where an RP coordinates callback consumption, send the same valid callback to independent handlers and
replay it after restart. Check that malformed parameters cannot consume pending state; only the successful
claimant contacts the Token Endpoint; and a failed exchange does not release its claim. This tests the
core's recommended coordination without prescribing shared storage for every RP.

For a Relay, exercise upstream approval beyond the initial deadline, unavailable or malformed UserInfo,
and revocation around the remote-check boundary. Remote checking and local issuance are separate events;
there is an unavoidable interval between them. Keep upstream identity and lifetime bindings intact through
that interval and test the profile's freshness bound.

For signing-key rotation, use cached readers, both known and unknown key identifiers, failed refreshes and
compromise removal. Removing a key from the live JWK Set does not instantly remove it from every cache.
Exercise emergency trust withdrawal separately from routine rotation.

## Interpreting evidence

Independent connections and processes exercise different failures from an in-memory state-machine test.
Deterministic schedules help reproduce races, while HTTP transcripts establish observable outcomes. Code
inspection and operational drills supply evidence that a boundary harness cannot obtain. Label the kind
of evidence when drawing conclusions, and redact live credentials without losing the relevant bindings.

A second storage adapter is not an independent protocol implementation. Cross-implementation sign-ins,
independent cryptographic verification and external security review can expose shared assumptions that a
single test suite misses. A bounded state-machine exploration is useful when its assumptions and bounds
are understood; it does not prove behavior outside them.

A test that unrelated Owner/client pairs progress while one pair is blocked detects global contention. It
does not establish deployment capacity. Measure growing history, concurrent sign-ins, polling, revocation,
cleanup and failures with declared hardware, request mix, pool bounds and latency percentiles. Operational
readiness also depends on real Owner authentication, rate limits, monitoring, rotation and recovery.
