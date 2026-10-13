# Agent Login Relay Profile - draft 0.2 (proposed)

Proposed companion to [Agent Login Core](agent-login-core.md). Terms, requirements language and parameter names are defined there; "Core" references that document. Relay conformance is separate from direct sign-in.

## 1. Purpose

A Relay authenticates an Agent at its Home Issuer and issues tokens to a Relying Party that configures one Issuer. It MUST meet Core's Issuer requirements except where this profile differs, and publish the Relay metadata in Core Section 2.4. The Relying Party trusts the Relay as fully as an Issuer: handle discovery detects inconsistent routing, but cannot prove that the Relay consulted the Home Issuer.

## 2. Upstream Authentication

The Relay MUST obtain the handle from `login_hint` or Section 4's `identify`, perform Core Section 2 discovery, and reject Home Issuers outside `home_issuers` or missing REQUIRED metadata. It MUST reject a downstream request lacking both `email` scope and `login_hint` with `invalid_request` before contacting the Home Issuer; otherwise the Relying Party could not verify Core Section 2.5's handle binding.

The upstream Authentication Request MUST use Core Section 5.3's JSON path, the Relay's own `redirect_uri`, `state`, `nonce` and PKCE, and `login_hint` set to the handle, forwarding `prompt=none` and `max_age` when present downstream. The Relay MUST bind upstream `state`, `session_token` and the validated identity to one local transaction; a later upstream response MUST NOT replace its Agent or Owner. Its upstream `redirect_uri` host MUST equal its Issuer Identifier's host; registration MUST state `relay_issuer` (Core Section 4.4).

The Relay MUST request `email` and `profile` upstream, requesting Owner scopes only when requested downstream. Without Registered Client status upstream, Owner scopes MUST fail with `invalid_scope` before contacting the Home Issuer. It MUST validate the upstream ID Token under Core Section 5.7, require `email` equal to the transaction's handle, and preserve upstream `auth_time` when `max_age` was requested. Relay processing is not a new Agent authentication.

The Relay MUST enforce Core Section 7.6 locally per (`home_iss`, upstream `owner_sub`, downstream `client_id`), and MUST NOT set `max_signups_per_owner` upstream. Core's address-based inheritance and post-Owner-deletion retention rules apply at the Home Issuer; the Relay cannot infer an undisclosed address or deletion event. A new upstream `owner_sub` therefore starts a new Relay quota identity.

## 3. Subjects and Claims

The Relay MUST derive `sub` as `base64url(SHA-256("agent-login-sub|" || home_iss || "|" || upstream sub))`, with UTF-8 inputs, and `owner_sub` likewise using prefix `agent-login-owner|` and upstream `owner_sub`. It MUST map Claims as follows:

| Claim | Value |
| --- | --- |
| `iss`, `home_iss` | Relay and Home Issuer Identifiers, respectively |
| `aud`, `nonce` | Downstream client and request nonce |
| `jti`, `iat` | New identifier and downstream issuance time |
| `scope` | Downstream granted scopes |
| `auth_time` | Upstream authentication time; REQUIRED for downstream `max_age` |
| `actor_type` | Upstream value |
| `email`, `email_verified` | Upstream values, only under `email` scope |
| `name`, `preferred_username`, `owner_sub` | Upstream or derived values, only under `profile` scope |
| Owner Claims | Upstream values, only under their downstream Owner scopes |
| `exp` | No later than upstream `exp` or downstream `iat` + T_TOKEN |

The Relay MUST NOT invent identity or Owner Claims. Both ID Tokens and UserInfo MUST obey Core Section 4.1's downstream scopes. The Relay MUST retain only validated upstream fields needed for these Claims and Section 5's checks, and MUST discard the upstream ID Token after validation.

## 4. Transaction Hand-off

Without a handle, the resource MUST report `awaiting_agent`/`identify`. The Agent Client posts `{"handle":"scout@example.com"}` without credentials to `next.url`; the Relay MUST accept this once, validate the handle, perform discovery and rate-limit by source. Once identified, it MUST report `awaiting_agent`/`follow`, the upstream resource's `url` as `next.url`, and `retry_after`, except during an upstream Owner wait.

The Agent Client MUST follow only a Relay transaction it started, apply Core Section 6.3 upstream, verify `client.redirect_host` equals the Relay's host, and assert with `deliver_to_session` `true`. It then polls the Relay.

During upstream `awaiting_owner`, the Relay MUST report `awaiting_owner`/`await_owner`, its own resource URL and `retry_after`. Before local expiry, it MAY extend its deadline to at most the earlier of upstream expiry and T_OWNER after local creation. It MUST NOT extend on a failed poll or revive local expiry. After approval it resumes `awaiting_agent`/`follow`; an extension remains bounded by upstream expiry. No other delay extends it, and a later upstream result MUST NOT authorise an expired local transaction.

The Relay polls upstream with its `session_token`. On `ready`, it MUST continue with `Accept: application/json`, redeem and validate the result, apply local signup caps including admitted, unfinished sign-ins, and check its own Consent Record for the Agent, downstream client and scopes. Upstream consent does not replace downstream consent. It reports `awaiting_consent` or `ready`; downstream `prompt=none` instead produces `denied`/`consent_required` when review is outstanding. Its disclosure MUST name the recipient of forwarded Owner Claims, which require its own covering consent.

As an exception to Core Section 6.4, the next session-bound `GET` MUST return once a local `transaction_token` authorising review and continue. Every terminal outcome except `completed` MUST release the continue URL to that session binding. Upstream `denied` or `expired` MUST set the same status and available reason while locally open; neither may overwrite a local terminal outcome or restart retention.

## 5. Live State and Retention

Before issuing a code, issuing tokens, or answering UserInfo, the Relay MUST make a new upstream UserInfo request using the bound upstream Access Token, under Core Section 2.2's fetch limits. It MUST require valid Core Section 3.3 JSON with the same upstream `sub`, recheck the applicable local transaction, code or token expiry and upstream token expiry, and repeat the check if more than N_FETCH has elapsed since that request began. A previous success cannot authorise another operation; a changed subject cannot rebind identity. Revocation may occur between the remote check and local issuance; this profile does not provide cross-Issuer atomicity.

| Upstream result | Required downstream result |
| --- | --- |
| `401` before code issuance | `denied`/`key_revoked` |
| `401` before token issuance | `invalid_grant` |
| `401` during UserInfo | `401` `invalid_token` |
| Other failure, including timeout, TLS failure, non-success status, malformed JSON, missing required Claim or mismatched `sub` | `503` `temporarily_unavailable`; include transaction `status` and `next` where Core Section 6.7 requires |

These failures MUST NOT authorise issuance or successful UserInfo, renew deadlines or change an earlier terminal outcome. A retry MUST repeat upstream and local one-use checks. `key_revoked` here denotes invalid upstream authority, not evidence of a particular lifecycle event.

Core's atomic issuance, replay, quota and retention requirements apply. The Relay MAY impose per-Home-Issuer limits and SHOULD retain other transaction details only as needed for abuse handling. It MUST retain the upstream Access Token solely for live checks while the local transaction can still issue a code, a downstream code remains redeemable or its issued Access Token remains live, then discard it. Downstream `expires_in` MUST NOT exceed the upstream Access Token's remaining lifetime.

## Conformance Checklist

Section numbers below refer to this profile unless prefixed "Core". Issuer requirements also apply except for the explicit differences above.

| # | Statement | Section |
| --- | --- | --- |
| L-1 | Meets applicable Issuer requirements and publishes Relay metadata | 1; Core 2.4 |
| L-2 | Accepts one rate-limited `identify`; checks discovered Home Issuer acceptance and metadata; rejects unsupported Owner scopes before upstream contact | 2, 4 |
| L-3 | Derives subjects exactly; sets downstream routing, time and replay Claims; invents no identity Claims | 3 |
| L-4 | Applies downstream consent separately; discloses Owner forwarding and requires covering consent | 4 |
| L-5 | Hands off to the upstream resource; polls with `session_token`; delivers its local token once and terminal continue URLs to the session binding; preserves local terminal outcomes | 4 |
| L-6 | Applies local per-owner/client caps including admitted, unfinished sign-ins; sets no upstream cap | 2, 4 |
| L-7 | Retains upstream Access Tokens only for live checks while downstream authority remains usable; discards upstream ID Tokens after validation | 3, 5 |
| L-8 | Binds upstream request and result; forwards requested `prompt` and `max_age`; requests `email` and `profile`; checks handle, redirect host and `relay_issuer` | 2 |
| L-9 | Checks upstream UserInfo before code/token issuance and each UserInfo response; bounds downstream token lifetime | 5 |
| L-10 | Rejects requests without `email` or `login_hint`; verifies the expected handle without adding unrequested downstream `email` | 2, 3 |
| L-11 | Mirrors Owner wait; any deadline extension precedes expiry, respects both bounds and survives no later expiry | 4 |
| L-12 | Maps upstream `401` and other failures distinctly at all three live checks; retries cannot bypass local one-use checks or renew expiry | 5 |
| L-13 | Requires fresh identity-bound live checks and rechecks local/upstream expiry; repeats checks older than N_FETCH | 5 |
| L-14 | Applies downstream scopes to both ID Tokens and UserInfo; retains only necessary validated fields; bounds ID Token expiry | 3 |
