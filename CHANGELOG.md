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
