# Changelog

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

