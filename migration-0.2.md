# Draft 0.2 migration notes (proposed)

This is an unapproved working-draft revision. Draft 0.1 remains in Git history; deployments need to pin the
exact draft because discovery's `1.0` value does not distinguish working drafts. Publication follows
[GOVERNANCE.md](GOVERNANCE.md), including its limited bootstrap process.

| Change | Effect on implementations |
| --- | --- |
| Optional algorithm | Use JOSE `Ed25519` from RFC 9864 instead of the legacy `EdDSA` identifier. ES256 remains required and the default. Verify library support before advertising Ed25519; do not rewrite a signed header. Existing Ed25519 key material and thumbprints are unchanged. |
| Known handle | Bind a known expected handle to state and send `login_hint`; reject a conflicting returned handle. This was a SHOULD in draft 0.1. |
| Current key uniqueness | One current enrollment per public key across an Issuer. Existing duplicates need separate keys or explicit retirement and authorized re-enrollment. |
| Lifecycle | Authorization remains bound to immutable Owner, Agent and enrollment identities. Handle reuse, disable/re-enable and key re-enrollment cannot restore old authority. Concurrent acceptance, completion and quota outcomes are indivisible. |
| Consent | Union scopes only under the same unexpired material metadata; changed terms replace scopes. Unknown prior terms require review. |
| Replay | Validate client, redirect URI and PKCE before replay side effects. Cross-instance callback consumption is recommended; parameter, session and Issuer validation and ordinary state consumption remain required. |
| Owner approval | Every approval method needs an Agent-inaccessible factor, including its provisioning and recovery paths. An authentication-method label alone does not establish this. |
| Authentication age | Positive `max_age` is checked at code authorization, token issuance and RP validation. Late approval cannot refresh `auth_time`: the flow fails with `login_required` before code issuance or `invalid_grant` at the Token Endpoint. Zero requests a fresh assertion for this request, following OIDC; it is not a zero-length network window. |
| Deleted-Owner counts | Lifetime counting holds while an Owner exists; afterward the Issuer's fixed published retention period applies. Re-verification during it inherits counts without authority; after expiry it does not. Inherited counts are not counted twice or erased from a live Owner when an older retention record expires. |
| Relay | The profile and its checklist are now [separate](relay-profile.md). Relay sign-in without `email` needs a pre-bound `login_hint`. Claims, Owner waits and live-state failures have explicit rules. Relay counting remains limited to upstream Owner identifiers, not undisclosed email history. |
| Signing-key caches | Observe HTTP freshness and T_CACHE; a failed refresh cannot extend validity. Removing a compromised key cannot immediately invalidate cached copies. |

Address comparison for retained quota linkage preserves parsed local-part octets and lowercases the A-label
domain. Provider alias rules are not inferred. Address changes retain existing counts and inherit applicable
retained counts, without transferring an earlier Owner's credentials or identities.

Reference implementations need a separate compatibility pass for these changes; their earlier test results
are not a claim of draft 0.2 conformance. New runtime features, schemas and reporting infrastructure are outside
this editorial checkpoint. [Implementation guidance](implementation-guide.md) covers storage and recovery
techniques without prescribing them as protocol requirements.
