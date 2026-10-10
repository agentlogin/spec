# AgentID interoperability notes (informative)

AgentID (AgentMail, Inc., `https://auth.agentid.com`, public since 6 October 2026) is the first widely deployed
sign-in for agents. Agent Login keeps its relying-party surface wire-compatible so that an application can
accept both through one code path, and so that an AgentID-enabled application needs only configuration to add
an Agent Login issuer. Facts below were verified against the live service on 9–10 October 2026; see the research
log in the `agentid-research` folder of the reference repository for evidence.

## What is the same

| Aspect | AgentID | Agent Login |
| --- | --- | --- |
| Flow | OIDC authorization code, PKCE S256 mandatory for unregistered clients | Same |
| Signature | ES256, JWKS at `jwks_uri`, stable `kid`s with overlap | Same (ES256 REQUIRED; EdDSA OPTIONAL) |
| Token lifetime | id_token and access token 600 s, code 60 s single-use, no refresh | Same defaults |
| `authorization_response_iss_parameter_supported` | true | REQUIRED |
| Claims | `actor_type`, `sub`, `email`, `email_verified`, `name`, `preferred_username`, `owner_sub`, `owner_name`, `owner_email`, `owner_email_verified` | Same names and semantics, plus `home_iss`, `owner_verified_via` |
| Scopes | `openid email profile owner_profile owner_email` | Same, plus `agent_key` |
| Unregistered clients | `client_id` is an https URL; redirect URI on the same host; `openid email profile` only | Client ID Metadata Document; same scope limit |
| Per-owner caps | Issuer-enforced, outcome `signup_limit_reached` | Same error code |
| Account disable | Owner disables one agent at one app; next authorization ends in `access_denied` | Same |
| Revocation | Deleting the agent's key invalidates unexpired access tokens within seconds; `userinfo` answers 401 | Same, plus bulk revoke and optional push signals |

## What differs

| Aspect | AgentID | Agent Login |
| --- | --- | --- |
| Identity | An AgentMail inbox; the issuer is fixed | A handle on any domain; the domain selects the issuer (WebFinger) |
| Agent credential | Key generated in a browser, or a bearer API key used once to approve; the browser-free path exists but is undocumented | Key generated and held by the agent; documented JSON transaction API; browser page is a convenience |
| Transaction API | Page endpoints (`/v0/authorize/enrollment`, `/authenticate/browser`, `/decision`, `/continue`) with CSRF and a custom header | `/transactions/{id}` JSON resource with `state` and `next` on every response, no cookies |
| Consent memory | 180 days documented; in testing the review screen appeared on every repeat sign-in for an open client | Remembered consent skips review unless the client sets `prompt=consent` or the issuer policy requires review |
| Registration | Console with human approval; `/v0/register` closed | RFC 7591 with initial access token, or console |
| `scope` claim | Advertised, absent for open clients | Always present |
| Hosting | Single provider | Any; reference implementation under Apache-2.0 |

## Accepting both in one application

1. Configure two OIDC connections: issuer `https://auth.agentid.com` and your Agent Login issuer or relay.
2. Key user records on `(iss, sub)`. Both issuers guarantee `sub` stability per agent, neither guarantees it
   across issuers.
3. Branch on `actor_type == "agent"` for agent policy; both issuers set it.
4. Apply per-owner limits on `owner_sub`; both issuers emit it with the `profile` scope. Values are not comparable
   across issuers.
5. For owner contact, request `owner_email`; both issuers deliver it only to registered clients.

## Mapping for an Agent Login client talking to AgentID

An agent client MAY implement an AgentID adapter: start the transaction at the application as usual, read the
22-character `auth_token` (equal to the transaction `jti`) from the AgentID wait page's
`agentid-session-action` metadata, approve with `POST https://api.agentmail.to/v0/inboxes/{inbox}/authorize`,
and complete with the page endpoints listed above. This path is unsupported by AgentMail and may change.
