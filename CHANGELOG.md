# Changelog

## Working draft 0.2 (24 October 2026)

Reduced the proposal to observable protocol rules; moved Relay behavior and its checklist into a companion
profile and storage, retry, cleanup, restore and audit techniques into an informative implementation guide.
Published under the limited working-draft bootstrap; see the [publication record](publication-0.2.md).
The publication edits change status, date and review documentation, not the protocol rules at revision
`a000e29c7af91d3fd8a5a4ad6241e2b10aabcc78`.

- Preserve immutable identity binding, concurrent reservation/completion guarantees, effective expiry and
  retention that later invalidation cannot restart.
- Preserve consent scopes only within matching unexpired terms; require authenticated code-replay effects
  and independent Owner approval factors, including enrollment and recovery.
- Require known-handle binding and exclusive active enrollment per key; use optional JOSE `Ed25519`.
- Fail stale positive `max_age` requests; keep zero's OIDC fresh-authentication meaning.
- Bound deleted-Owner quota inheritance by a fixed published retention period; never double-count inheritance.
- Keep callback validation and ordinary state consumption mandatory; coordination across instances is SHOULD.
- Separate test coverage from protocol conformance; move fault-injection procedures out of the checklist.
- Keep read-only link, section-reference and cryptographic-example checks. Shelve the generated inventory,
  reporting schema and unfinished wire-schema work.
- Add a limited, public-review bootstrap for 0.x drafts; preserve independent interoperability for 1.0.

Review corrections: make redirect Issuer comparison explicit; restore discovery and privacy explanations
and the AgentID state mapping; restore Relay-registration coverage and compact unpublished checklist IDs.
The bootstrap has no fixed waiting period, and a published zero retention period explicitly ends a deleted
Owner's quota inheritance immediately. Migration notes describe RP library checks that can reject a delayed
`max_age=0` flow. Unfinished tooling is preserved on separate archive branches.

Peer-review fixes permit endpoint-appropriate transaction and management credentials while keeping discovery
document fetches credential-free. Pending enrollments no longer reserve another Agent's public key; active
exclusivity is enforced only after proof verification. Checklist exceptions and role-specific obligations now
match the core, including optional `next.method` and `next.url` when `action` is `none`. The transaction URL
boundary is explicit for resource and actionable next-step URLs, including Relay hand-off; secret layout and
URL rotation remain implementation choices.

See [migration-0.2.md](migration-0.2.md) for compatibility changes.

## Draft 0.1 (10 October 2026)

First public working draft of Agent Login Core 1.0, the conformance checklist and the AgentID
interoperability notes. Revised the same day after an internal four-lens review (protocol security, internal
consistency, fresh-implementer read, research fidelity: 166 findings, 13 of them blockers) before publication
of this version.

Decisions taken in this draft (open for implementer feedback):

- Handles are ASCII `local@domain`; local parts compare octet-for-octet, domains case-insensitively.
- Discovery is WebFinger first; a `_agentlogin` TXT record is a fallback only when DNSSEC-validated and
  confirmed by the Issuer's `handle_domains`.
- Every fetch of a discovery, metadata, JWK Set or client document applies server-side request forgery protections.
- The Agent side is one Transaction Resource with seven statuses (`awaiting_agent`, `awaiting_owner`,
  `awaiting_consent`, `ready`, `completed`, `denied`, `expired`) and the next actions `assert`, `review`,
  `await_owner`, `continue`, `identify`, `follow`, `none`; every response carries `status` and `next`.
- One signature per sign-in: the assertion (`typ agent-login+jwt`; `iss`/`sub` = handle, `aud`, `txn`, `nonce`,
  `iat`, `exp`, `jti`, optional `accept_disclosure` and `deliver_to_session`); a `transaction_token` authorises
  the decision and continue steps; a `session_token` (JSON path) or cookie (HTML path) identifies the Session Holder.
- Transaction fixation defence: the result reaches the Session Holder only when the assertion says `deliver_to_session`.
- Gate order: disabled Account, per-owner cap, Owner approval, review; `ready` only when no gate is outstanding.
- Consent Records really skip the review; at most 180 days from last use; `prompt=consent`, `require_review` and
  issuer policy override.
- Open Clients use Client ID Metadata Documents only; the bare-origin style is not part of this draft.
- ES256 required, EdDSA optional, nothing else; `alg` must match the key type; 600 s tokens; no refresh; `scope`
  claim always present.
- Revocation ends open transactions, voids unredeemed codes and invalidates outstanding Access Tokens at once;
  push signals are optional and informative.
- Relay profile: handle via `login_hint` or `identify`; `follow` hand-off; domain-separated derived subjects;
  the Relay keeps its own Consent Records per Relying Party, enforces caps itself, and proxies live-state checks.
- Owner approval requires an authenticated Owner session; `share_owner` is granted only with an Owner Credential.
- Terminal outcomes reach the Relying Party through the continue step; a table maps outcomes to OAuth errors.

### Second review pass (10 October 2026)

- Fixed the escape sequences in Section 5.3 (`\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`).
- `transaction_token` is valid until the key is revoked or T_RETAIN after the terminal state; `session_token` presentation and the continue URL's credential rule are stated (Sections 5.3, 6.3, 6.5).
- The `deliver_to_session` rule moved into the assertion table (Section 6.3); `redirect_host` defined (Section 6.1); `invalid_assertion` covers `alg` mismatch and enrollment-proof failures (Section 6.7).
- Disabled Accounts void unredeemed codes like key revocation (Sections 5.6, 7.4); effects of revocation and disabling are a table (Section 7.4).
- Conformance classes scoped precisely (Section 12); checklist items I-33 to I-37 and R-12 added.
- Prose trimmed by about a fifth: top-level table of contents, single statements for `prompt`, `home_issuers`, the escape rule and the algorithm-matching rule, SHOULDs moved from Sections 10 and 11 into the normative sections, Relay claim mapping as a table, Appendix B delegated to the interop notes.

### Security review pass (10 October 2026)

Three independent reviews (transaction mechanics; OAuth/OIDC profile; keys, Owners, Relay) produced two blockers, about a dozen majors and thirty minors; all were applied.

- Owner approval sessions can no longer be opened with a mailbox code alone (Sections 6.6, 7.5, 7.8), since Agents read their Owners' mail.
- Relay hand-off: an Agent Client follows `follow` only for a Relay transaction it started, and only to a Home Issuer transaction whose client redirects to the Relay's host; the Relay sends `login_hint` and `prompt=none` upstream, requests `email`, verifies it, registers with `relay_issuer`, and the Home Issuer's approval page names it as a Relay (Sections 4.4, 6.6, 8.2, 8.4).
- "A transaction it started itself" is defined; `requester` is informative only; the wait page never embeds `session_token`; the cookie is set once (Sections 5.3, 6.1, 6.3).
- Delegated Credentials are bound to one handle, may only disable Accounts, cannot touch `permissions`, and are invalidated by the Owner's revoke-all; `pending` keys are revoked too; disabled or deleted Agents cannot sign in; Consent Records and Accounts belong to the Agent, not the handle (Sections 6.3, 7.2 to 7.4, 7.8).
- OAuth/OIDC alignment: RS256 departure stated, `id_token_signed_response_alg`, `request`/`request_uri` rejected rather than ignored, `response_mode`, `POST` to the Authorization Endpoint, `auth_time` with `max_age`, loopback redirect ports, pre-transaction error delivery, `typ` comparison per RFC 7515, `Pragma: no-cache`, `no-store` on redirects, `pairwise` removed, RFC 7591 profile, `target_link_uri`, IANA corrections and the `_agentlogin` node-name registration.
- Fetch protections now cover every endpoint learned through discovery, with the IANA special-purpose registries and NAT64/IPv4-mapped handling (Sections 2.2, 10.6).
- Atomicity of assertion acceptance and code issuance; decisions outside `awaiting_consent` refused; Consent Records deleted after T_CONSENT; per-owner counts survive deletion.
- Conformance checklist: I-38 to I-49, R-12 to R-14, A-9, L-8, L-9 added; I-7, I-8, I-12, I-19, A-3, A-4, L-5 revised.

### Concision and consistency pass (10 October 2026)

Nine section editors proposed cuts; each set was judged by three independent verifiers (requirements, cross-references, exactness) and only unanimous edits were applied: 46 edits, about 240 words. The editors' finding is that the remaining text is one requirement per clause; further shortening would mean removing requirements or splitting the Relay profile into a companion document.

Inconsistencies the pass surfaced, now resolved:

- `login_hint` was a MUST in Section 9, a SHOULD in Section 10.1 and OPTIONAL in Section 5.1. It is a SHOULD, stated in Section 9; Section 10.1 gives the reason.
- Owner verification is required before an Agent's first sign-in (Section 7.5), which Section 10.8 already assumed and per-owner caps depend on; it was previously required only before issuing Owner Claims.
- Section 10.4 no longer suggests that Section 2.5 detects a Relay naming a Home Issuer it never consulted (Section 8.1 says it cannot).
- One criterion for version 1.0 (interoperate end to end and pass the checklist), stated in Status and GOVERNANCE.md.
- Token presentation (`Authorization: Bearer`) is stated once, in the Section 6 introduction.

### Implementation feedback (10 October 2026)

- Section 5.8: a Relying Party that accepts Issuers by discovery may accept an agent-initiated start whose `iss` is the Issuer that discovery for `login_hint` yields; it still sends no request to any other `iss`. Found while building the relying-party kit: the previous text made agent-initiated start impossible under open federation.
- Section 5: the JWK Set is exempt from `no-store` (Section 7.7 relies on its cache lifetime).
- Section 4.4: an Issuer obtains a Relay's `op_policy_uri` from the Relay's metadata, so that the approval page of Section 6.6 can show it.
- Section 6.7: error precedence stated (`invalid_transaction`, `invalid_token`, `transaction_expired`, then any other); the text previously left the answer to a decision posted with the wrong credential on a `ready` transaction open.
- Checklist: I-17 says `303`; I-32 no longer lists `request` and `request_uri` as ignored (I-38 governs).
- Section 5: `no-store` also covers the UserInfo and registration endpoints.
- Sections 4.4 and 6.1: "host" includes the port.
- Section 7.8: `404` takes precedence over `403` for a Delegated Credential; Section 7.2: a duplicate or revoked key is refused with `invalid_request`.

### External review of the reference implementation (10 October 2026)

A review of the reference implementation at commit 9b6dd09 reported twelve defects; all were reproduced and fixed there. Where the specification was silent, it now says:

- Section 5.6: a code is redeemed at most once, atomically with respect to concurrent Token Requests.
- Section 6.1: when several review reasons hold, `consent_reason` is the first that keeps the review outstanding. (Section 6.3 step 10 already made `prompt=consent` and `require_review` independent of `accept_disclosure`; the reference issuer did not.)
- Section 6.4: a sign-in that relies on a Consent Record updates its time of last use.
- Section 6.6: a requested Owner Claim the Issuer cannot supply ends the transaction `denied` with `access_denied`.
- Section 7.6: the cap counts Agents with an in-flight transaction, not transactions; expired transactions hold no place; check and reservation are atomic; an Account is counted once.
- Follow-up from re-testing the fixes: a Consent Record is renewed only by a sign-in that reaches `ready` (Section 6.4); a completion that creates an Account is atomic with the cap check (Section 7.6); a discovery result reached through redirects is no fresher than its least fresh hop (Section 2.2).

### Second external review of the reference implementation (11 October 2026)

A second review, at commit 84e5f3f, reported twelve further defects; all were reproduced and fixed there. Two rules that the text implied are now stated:

- Section 7.4: a revocation, disable or deletion prevails over requests processed concurrently with it, and a key enrolled again after its expiry restores nothing the expired record asserted (checklist I-26).
- Section 9 item 10: whether a Relay relays a Home Issuer is judged by the Relay's current `home_issuers` (checklist R-13).
