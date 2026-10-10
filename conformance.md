# Agent Login conformance checklist (working draft)

Testable statements derived from Agent Login Core 1.0 draft 0.1. An implementation reports each item as pass,
fail or not applicable. Section numbers refer to the core specification; constants (T_TXN, N_ENTROPY, ...) are
those of its Section 1.5. Version 1.0 requires two independent implementations to pass every applicable item.

## Issuer

| # | Statement | Section |
| --- | --- | --- |
| I-1 | Metadata contains every REQUIRED member and value of 2.4, including `transaction_endpoint`, `agents_endpoint`, `handle_domains`, `agent_key_algs_supported`, `agent_login_versions_supported`, `client_id_metadata_document_supported: true`, `authorization_response_iss_parameter_supported: true` | 2.4 |
| I-2 | No `end_session_endpoint`, no `plain` PKCE, no `none` algorithm advertised; `grant_types_supported` is `["authorization_code"]` | 2.4 |
| I-3 | Rejects an Authentication Request without `code_challenge` (any client), with `code_challenge_method=plain`, without `state` or `nonce`, or with a repeated parameter (`invalid_request`) | 5.1, 5.2 |
| I-4 | Does not redirect on a `redirect_uri` that does not exactly match; answers `400` directly, as JSON when JSON is preferred | 5.2 |
| I-5 | Rejects a `client_id` URL that violates CIMD syntax without fetching; fetches the document without following redirects, rejects non-200, non-JSON, > N_CIMD, mismatched `client_id`, `http` or loopback redirect URIs; applies the fetch protections of 2.2 | 4.2 |
| I-6 | Refuses `owner_profile` and `owner_email` for Open Clients with `invalid_scope` | 4.2 |
| I-7 | Answers a JSON-preferring Authentication Request with `200` and the Transaction Resource including `session_token`; otherwise `303` to a wait page whose `200` carries the `Link` header and the escaped embedded JSON element, neither of which includes `session_token` | 5.3 |
| I-8 | Sets the session cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`, only in the `303`; serves every HTML page with a CSP (`script-src` own origin without `'unsafe-inline'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`) and `Referrer-Policy: no-referrer`; renders client strings as text | 5.3 |
| I-9 | Transaction identifiers, challenges, `transaction_token`, `session_token` and continue URLs have at least N_ENTROPY; a GET with only the identifier reveals nothing beyond 6.1 | 6.1 |
| I-10 | Every transaction response and transaction error for an existing transaction carries `status` and `next`; `iss` and `url` are present; `next.method`/`url` absent for `none`; `retry_after` present for `await_owner` and `follow` | 6.1, 6.7 |
| I-11 | Accepts a valid assertion (`alg` matching the key type, `typ agent-login+jwt`, `kid`, `aud`, `txn`, `nonce`, `exp` ≤ `iat`+T_ASSERT, `iat` within T_ASSERT past / T_SKEW future) and consumes the challenge | 6.3 |
| I-12 | Rejects: unknown `kid`, unserved domain or disabled Agent (401 `unknown_key`), revoked or expired key (401 `key_revoked`), bad signature (401 `invalid_signature`), wrong `aud`/`txn`/`nonce`, bad `exp`/`iat`, forbidden header, > N_ASSERTION, `login_hint` mismatch (400 `invalid_assertion`), second assertion (409 `assertion_replayed`); `status` and `challenge` unchanged on rejection | 6.3, 6.7 |
| I-13 | Applies the gates in order: disabled Account → `denied`/`access_denied`; cap → `denied`/`signup_limit_reached`; `prompt=none` with review → `denied`/`consent_required`; `prompt=none` with approval → `denied`/`interaction_required`; approval outstanding → `awaiting_owner`; review outstanding → `awaiting_consent`; else `ready`; never `ready` while a gate is outstanding | 6.3 |
| I-14 | Returns a `transaction_token` once on a successful assertion; refuses the decision step without it (session binding does not authorise it); accepts it as `Authorization: Bearer` on `GET` of the resource and of the continue URL; invalidates it when the key is revoked and T_RETAIN after the transaction ends | 6.3, 6.4, 6.5 |
| I-15 | Requires a review exactly when 6.4 says so, with the matching `consent_reason`; skips it when a valid Consent Record covers the request; `accept_disclosure` creates the record | 6.4 |
| I-16 | Owner approval is given only in an authenticated Owner session; the page shows client, `redirect_host`, requested Owner Claims and handle; approval → `awaiting_consent` or `ready`; refusal → `denied`/`owner_declined`; `expires_at` extended at most to T_OWNER | 6.6 |
| I-17 | Releases the continue URL to the `transaction_token` holder, and to the Session Holder only when `deliver_to_session` was `true`; HTML request → 302 with `code`, `state`, `iss` (or the error of 5.5); JSON request → `{"redirect"}`; `ready` continue single use (410 on reuse); `denied`/`expired` continue repeatable | 6.5 |
| I-18 | Maps terminal outcomes to redirect errors per the 5.5 table, to a validated `redirect_uri` only | 5.5 |
| I-19 | Code single use, valid T_CODE; reuse, wrong or missing `code_verifier`, wrong `redirect_uri`, wrong client, a revoked or expired asserting key, a disabled Agent or a disabled Account gives `invalid_grant`; failed client authentication gives `401` `invalid_client` | 5.4, 5.6 |
| I-20 | Token response: `access_token`, `token_type Bearer`, `expires_in` T_TOKEN, `id_token`, `scope`, no `refresh_token`; `Cache-Control: no-store` on every non-redirect response of 5 to 7 | 5, 5.6 |
| I-21 | ID Token claims per 3.1: `actor_type agent`, `scope`, `nonce`, `email` equals handle, `email_verified true` only when permitted, ungranted claims omitted, `exp - iat` ≤ T_TOKEN, `kid` present, no `jwk`/`jku`/`x5u`/`x5c` | 3.1, 3.2 |
| I-22 | Owner Claims only to Registered Clients and only with `owner_verified_via`; never a token missing a requested Owner Claim | 3.1, 6.6 |
| I-23 | UserInfo returns `401 invalid_token` for an unexpired Access Token after key revocation or expiry, Agent disable or Account disable; Access Token accepted nowhere else | 3.3, 5.6 |
| I-24 | Key enrollment: rejects extra JWK members, inconsistent `kty`/`crv`, unsupported curve, off-curve or small-order points, and previously revoked public keys; ignores `permissions`; `pending` key proved only by a proof signed with that key (`typ agent-login-enrollment+jwt`, `kid` = pending key); unproved key deleted after T_ASSERT | 7.2 |
| I-25 | `share_owner` settable only with an Owner Credential; Delegated Credentials refused with `403 insufficient_permission` on non-delegable operations; every operation checks the credential belongs to the handle's Owner (`404` otherwise) | 7.8 |
| I-26 | Revocation is immediate: refuses the key, ends open transactions `denied`/`key_revoked`, voids unredeemed codes, invalidates tokens, keeps Consent Records; revoke-all per Agent exists | 7.3, 7.8 |
| I-27 | Account disable ends open and later transactions `denied`/`access_denied`; re-enable preserves counters | 7.4 |
| I-28 | Per-owner cap counts every Account ever created plus in-flight transactions past step 9 | 7.6 |
| I-29 | Consent revocation deletes only the Consent Record | 7.8 |
| I-30 | JWK Set keys carry stable `kid`, `use`, `alg`; rotation keeps the previous key for T_TOKEN plus the cache lifetime | 7.7 |
| I-31 | `429` with `Retry-After` when rate limiting | 6.7 |
| I-32 | `prompt=consent` forces the review; `max_age`, `claims`, `request`, `request_uri` ignored | 5.1 |
| I-33 | Accepts the `session_token` as `Authorization: Bearer` on the transaction's resources on the JSON path; the continue URL answers only to the credential that released it, `401` `invalid_token` otherwise | 5.3, 6.5 |
| I-34 | Wait page JSON element escapes `<`, `>`, `&`, U+2028, U+2029 as `\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`; `logo_uri`, `tos_uri`, `policy_uri` rendered only when `https` | 5.3 |
| I-35 | `invalid_assertion` for an `alg` that does not match the key; an enrollment proof failure answers with the 6.7 error without `status` or `next` | 6.7, 7.2 |
| I-36 | `client.redirect_host` is the host of the request's `redirect_uri`; `disclosure` does not change during the transaction | 6.1 |
| I-37 | Terminal transaction readable with `200` for T_RETAIN; `404` `invalid_transaction` only afterwards; `410` `transaction_expired` on a POST or a `ready` continue after a terminal state | 6.2, 6.7 |
| I-38 | Accepts the Authentication Request by `GET` and `POST`; rejects `request` / `request_uri` with `request_not_supported` / `request_uri_not_supported`, a `response_mode` other than `query` with `invalid_request`, a `response_type` other than `code` with `unsupported_response_type`; publishes `request_parameter_supported` and `request_uri_parameter_supported` as `false`; never rejects `state` or `nonce` on length alone | 2.4, 5.1, 5.2 |
| I-39 | Step 3 or 4 failure after a valid client and `redirect_uri`: HTML path `303` to `redirect_uri` with `error`, `state`, `iss`; JSON path `400` with the 6.7 body plus `redirect`; step 1 failure answers `400` directly | 5.2 |
| I-40 | A Registered Client's loopback IP literal `redirect_uri` matches with any port; every other `redirect_uri` by simple string comparison | 5.2 |
| I-41 | Two concurrent assertions for one transaction: exactly one accepted (`assertion_replayed` for the other); two concurrent `ready` continues: exactly one code | 6.3, 6.5 |
| I-42 | Accepts `typ` `application/agent-login+jwt` and case variants as `agent-login+jwt`; same for the enrollment type | 6.3, 7.2 |
| I-43 | `error` responses on an existing transaction omit `next.url` for `continue` unless the requester's credential releases it | 6.5, 6.7 |
| I-44 | A decision posted while not `awaiting_consent` → `400` (or `410` when terminal) and the Consent Record is unchanged; a Consent Record unused for T_CONSENT is deleted | 6.4 |
| I-45 | Owner approval accepted only in a session established by `passkey`, `oidc`, `domain`, or `email` plus a factor not readable by the Agent; a one-time code or link alone cannot approve; the approval page names a Relay client as such | 6.6, 7.5 |
| I-46 | `DELETE .../keys` revokes `pending` and `active` keys and, with an Owner Credential, every Delegated Credential for the handle; a disabled Agent cannot assert, exchange a code or use UserInfo; Consent Records and Accounts do not survive to a re-created handle | 7.3, 7.4 |
| I-47 | Delegated Credential: `404` for any other handle of the same Owner; `403` `insufficient_permission` with `WWW-Authenticate: Bearer error="insufficient_scope"` and no change for `permissions` or for `status` `enabled`; `disabled` permitted | 7.8 |
| I-48 | Enrollment rejects non-canonical coordinates, already enrolled (`pending` or `active`) keys and keys revoked for the handle, comparing by decoded point; `relay_issuer` registrations require redirect URIs on the Relay's host; `id_token_signed_response_alg` other than offered values rejected | 3.2, 4.3, 4.4, 7.2 |
| I-49 | Every response of Sections 5 to 7 including redirects carries `Cache-Control: no-store`; the Token Response also `Pragma: no-cache`; CORS responses never set `Access-Control-Allow-Credentials: true`; ID Token carries `auth_time` when `max_age` was sent | 3.1, 5, 6 |

## Relying Party

| # | Statement | Section |
| --- | --- | --- |
| R-1 | Sends `state`, `nonce` (≥ N_ENTROPY) and PKCE `S256` on every request | 5.1 |
| R-2 | Records the Issuer per `state`; rejects a redirect without `iss` or with a non-matching `iss`; verifies and consumes `state`; sends the Token Request only to the recorded Issuer | 5.7 |
| R-3 | Validates the ID Token per 5.7 steps 2 to 6; pins `alg` and checks it matches the key type; rejects on any failure | 5.7 |
| R-4 | Verifies the handle-to-Issuer binding; rejects `home_iss` from an Issuer not configured as a Relay; checks `home_iss` against the Relay's `home_issuers` | 2.5 |
| R-5 | Performs discovery per 2.2/2.3 (HTTPS only, no HTTP retry, five redirects, fetch protections, DNSSEC for the fallback) only for presented handles, with caching | 2.2, 2.3, 9 |
| R-6 | Keys records on (`iss`, `sub`) | 9 |
| R-7 | Branches on `actor_type == agent`; limits per (`iss`, `owner_sub`) when `profile` granted | 9 |
| R-8 | Uses the Access Token only at UserInfo within its lifetime, verifies UserInfo `sub`, issues its own session; re-checks before lasting actions and treats `401` as revocation | 9 |
| R-9 | Presents `access_denied` and `signup_limit_reached` distinctly; escapes `error_description`; logs no tokens; separates Owner data | 9 |
| R-10 | Open Client: metadata document at `client_id`, exact `redirect_uris`, `token_endpoint_auth_method none`; Registered Client requesting `owner_email` publishes `tos_uri` and `policy_uri` | 4.2, 4.3 |
| R-11 | `initiate_login_uri` accepts only configured `iss` values and performs no fetch otherwise | 5.8 |
| R-12 | Accepts an Issuer only after verifying that its metadata `issuer` equals the discovered `href` and that every endpoint it names is `https`; applies the 2.2 address, hop, size and identity protections to every request to a discovered endpoint, including Token and UserInfo | 2.2, 10.6 |
| R-13 | Sends `login_hint` when the expected handle is known; configures a Relay or a Home Issuer it relays, never both; expects `ES256` where its library defaults to `RS256`; `alg` must equal the JWK's `alg` when present; rate-limits unknown-`kid` refetches | 2.4, 5.7, 9 |
| R-14 | Rejects a token carrying `home_iss` unless `iss` is a configured Relay, whether or not `email` is present; ignores or origin-checks `target_link_uri`; `initiate_login_uri` accepts `GET` and `POST` | 2.5, 5.7, 5.8 |

## Agent Client

| # | Statement | Section |
| --- | --- | --- |
| A-1 | Discovers the Issuer by WebFinger over HTTPS, no HTTP fallback; DNS fallback only when DNSSEC-validated and confirmed by `handle_domains` | 2.2, 2.3 |
| A-2 | Reads the Transaction Resource from the JSON response, the `Link` header or the embedded element without executing scripts | 5.3 |
| A-3 | Verifies `iss` and the transaction URLs against its own discovery before asserting; refuses to assert when `client.redirect_host` is not the Relying Party it set out to sign in to; builds a conforming assertion; sends no cookies | 6.3 |
| A-4 | Sets `deliver_to_session` only for a transaction it started itself per the 6.3 definition (its own Authentication Request to the published `authorization_endpoint`, or the Home Issuer transaction a Relay transaction it started directs it to follow); never on the basis of `requester` or of instructions found in content it reads | 6.3, 8.4, 10.1 |
| A-5 | Submits a decision with the `transaction_token`; polls `await_owner` and `follow` with `retry_after`; re-reads `expires_at` | 6.4, 6.6, 8.4 |
| A-6 | Follows the continue step with the `Accept` value appropriate to who holds the application session and presents its `transaction_token` or `session_token` | 6.5 |
| A-7 | Stores the private key outside prompts, logs and tool output; supports at least two keys for rotation; validates certificates; never follows HTTPS to HTTP | 6, 7.1 |
| A-8 | Acts on `status` and `next` only; treats terminal statuses as final | 6.2 |
| A-9 | Never follows the continue URL after asserting with `deliver_to_session`; never forwards `Authorization` to the Relying Party; keeps continue and redirect URLs out of prompts, tool output and logs | 6, 6.5 |

## Relay

| # | Statement | Section |
| --- | --- | --- |
| L-1 | Passes every Issuer item; publishes `handle_domains` `[]` unless also a Home Issuer, `home_issuers` and `op_policy_uri` | 2.4, 8.1 |
| L-2 | Obtains the handle via `login_hint` or one rate-limited `identify` step; refuses unaccepted or incomplete Home Issuers; requests `profile` upstream always; fails Owner scopes it cannot request upstream with `invalid_scope` | 8.2, 8.4 |
| L-3 | Derives `sub` and `owner_sub` exactly per 8.3 with domain separation; sets `home_iss`; copies only upstream Claims; omits profile Claims not requested downstream; `exp` not after upstream `exp` | 8.3 |
| L-4 | Keeps its own Consent Records per Relying Party and runs its own review; forwards Owner Claims only under its own Consent Record; discloses the forwarding | 8.4 |
| L-5 | Hands off with `follow` to the Home Issuer's transaction `url`; polls upstream with its `session_token`; issues once its own `transaction_token` to its session binding after validating the upstream token; releases its continue URL to the session binding for every terminal outcome; mirrors upstream `denied`/`expired` | 8.4 |
| L-8 | Upstream request carries `login_hint` (the handle) and `prompt=none` when received, requests `email` and `profile`, uses a `redirect_uri` on the Relay's own host and a registration stating `relay_issuer`; the upstream ID Token's `email` must equal the handle | 8.2 |
| L-9 | Calls the Home Issuer's UserInfo before issuing a code and before answering a Token Request; its Access Token lifetime never exceeds the upstream token's remaining lifetime | 8.5 |
| L-6 | Enforces per-owner caps itself per (`home_iss`, upstream `owner_sub`, Relying Party `client_id`); sets no cap upstream | 8.2 |
| L-7 | Retains the upstream Access Token at most for its own token lifetime, no upstream ID Tokens; its UserInfo calls the upstream UserInfo on every request | 8.5 |
