# Agent Login Core 1.0 - draft 0.1

| | |
| --- | --- |
| Status | Working Draft |
| Date | October 2026 |
| Editors | S. Arregger (SentFromAI); second editor sought, see GOVERNANCE.md |
| Repository | https://github.com/agentlogin/spec |

## Abstract

Agent Login is a profile of OpenID Connect for signing software agents in to web applications. An Agent is identified by a handle of the form `local@domain`; the domain publishes which Issuer vouches for its Agents, and an application verifies the Agent with OpenID Connect. The ID Token names the Agent, marks it as an agent and, when the application is registered and asks, names the human Owner accountable for it. The Agent proves possession of a key it holds through a Sign-in Transaction that a plain HTTP client completes without a browser.

## Status of This Document

This is working draft 0.1, published for implementer review. Behaviour MAY change without compatibility between drafts until two independent implementations interoperate end to end, after which the editors publish version 1.0 (GOVERNANCE.md, item 3). Feedback is collected in the repository issue tracker. The editors intend to submit this document as an Internet-Draft. No implementation is known to conform to this draft at the time of publication.

## Copyright and Licence

Text: CC BY 4.0. Code samples: Apache-2.0 in addition (Appendix C).

## Table of Contents

1. Introduction (1.1 Requirements Notation and Conventions, 1.2 Terminology, 1.3 Overview, 1.4 Relationship to OpenID Connect, 1.5 Constants)
2. Agent Handles and Issuer Discovery (2.1 Handle Syntax, 2.2 WebFinger Lookup, 2.3 DNS Fallback, 2.4 Issuer Metadata, 2.5 Binding a Handle to its Issuer)
3. The ID Token and UserInfo Response (3.1 Claims, 3.2 Signing, 3.3 UserInfo and Live State, 3.4 Example)
4. Scopes and Client Tiers (4.1 Scope Values, 4.2 Open Clients, 4.3 Registered Clients, 4.4 Client Metadata Defined by this Specification)
5. Authentication (5.1 Authentication Request, 5.2 Request Validation, 5.3 Transaction Creation and Session Binding, 5.4 Successful Response, 5.5 Error Response, 5.6 Token Request and Response, 5.7 ID Token Validation, 5.8 Agent-Initiated Start)
6. The Sign-in Transaction (6.1 Transaction Resource, 6.2 Statuses and Next Steps, 6.3 Assertion, 6.4 Review and Consent, 6.5 Completion, 6.6 Owner Approval, 6.7 Transaction Errors)
7. Agents, Keys, Owners and Caps (7.1 Agent Keys, 7.2 Key Enrollment, 7.3 Key Revocation, 7.4 Accounts, 7.5 Owner Verification, 7.6 Per-Owner Sign-up Caps, 7.7 Issuer Signing Keys and Rotation, 7.8 Management Operations)
8. Relay Profile (8.1 Purpose, 8.2 Upstream Authentication, 8.3 Derived Subjects and Claim Mapping, 8.4 Transaction Hand-off, 8.5 Relay Policy)
9. Relying Party Requirements
10. Security Considerations (10.1 to 10.10)
11. Privacy Considerations (11.1 to 11.5)
12. Conformance
13. IANA Considerations (13.1 to 13.5)
14. References (14.1 Normative References, 14.2 Informative References)
Appendix A. Complete Sign-in over HTTP (Informative)
Appendix B. Mapping to AgentID (Informative)
Appendix C. Notices

## 1. Introduction

Software agents sign up for applications today with a human's email address, read the human's one-time codes, and act under the human's account. The application cannot tell an agent from a person, cannot tell one person's fleet of agents from many customers, and has nobody on record when something goes wrong.

This specification gives the Agent an identity of its own. The Agent is named by a handle, `scout@example.com`. The domain `example.com` publishes which Issuer vouches for its Agents. The application runs an OpenID Connect Authorization Code Flow against that Issuer and receives an ID Token whose `actor_type` is `agent`, whose `sub` is stable for that Agent, and which carries the Owner's verified identity when the application is registered and requests it. The Agent authenticates by signing a server-generated challenge with a key that never leaves it.

### 1.1 Requirements Notation and Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as shown here.

Values to be taken literally are shown in `fixed-width`; the quotes are not part of the value. HTTP semantics and status codes are per [RFC9110]. JSON is per [RFC8259]; request and response bodies defined by this document are JSON objects with `Content-Type: application/json` unless stated otherwise. JWTs use the JWS Compact Serialization only. String comparison is by simple string comparison (Section 6.2.1 of [RFC3986]), and parameter names and values are case-sensitive, unless stated otherwise. ABNF is per [RFC5234]. Examples are non-normative; long values are wrapped for display only.

Example values used throughout: Agent handle `scout@example.com`; Owner Jane Doe, `jane@example.com`; Issuer `https://issuer.example`; Relay `https://relay.example`; Relying Party `https://client.example.org` with redirect URI `https://client.example.org/cb`, Client ID Metadata Document `https://client.example.org/client-metadata.json` and, when registered, `client_id` `s6BhdRkqt3`; `state` `Yq3nXr8vL2kT5wB9mC1dPz`; `nonce` `Vb7kQ2mR9tL4xN1cW8sJyA`; transaction identifier `3oQ7vK1dR8bN2mL9xA5yZw`; Agent Key identifier `gDfgvWhf8W3eJn4C6hIXLUIMp7wqzKT5UjXzAyQsbco`. The signatures in Appendix A verify against the keys printed there.

### 1.2 Terminology

This specification uses the terms "Authorization Code", "Authorization Endpoint", "Authorization Server", "Client", "Client Identifier", "Redirection URI", "Token Endpoint" and "Access Token" defined by OAuth 2.0 [RFC6749]; "ID Token", "Issuer Identifier", "OpenID Provider", "Relying Party", "UserInfo Endpoint" and "Claim" defined by OpenID Connect Core 1.0 [OpenID.Core]; "JWT", "JWS", "JWK" and "JWK Set" defined by [RFC7519], [RFC7515] and [RFC7517]; "Client ID Metadata Document" defined by [CIMD]; and "JRD" and "link relation" defined by WebFinger [RFC7033].

This specification also defines the following terms:

- **Agent**: a software process that signs in to Relying Parties under its own identity, acting for an Owner. The term says nothing about how the process is built or what it does.
- **Agent Handle** (handle): the identifier of an Agent, `local@domain` (Section 2.1).
- **Owner**: the human, or the organisation represented by its administrators, accountable for an Agent. Every Agent has exactly one Owner.
- **Issuer**: an OpenID Provider conforming to this specification that vouches for Agents whose handles are in domains delegated to it.
- **Home Issuer**: the Issuer that a handle's domain designates (Section 2).
- **Relay**: an Issuer that authenticates an Agent at its Home Issuer and issues its own ID Token for Relying Parties that can configure a single Issuer (Section 8).
- **Agent Key**: an asymmetric key pair whose private half the Agent holds and whose public half is enrolled at the Issuer (Section 7.1).
- **Agent Client**: the HTTP software that completes a Sign-in Transaction on behalf of an Agent: a browser, a command-line tool or a library.
- **Session Holder**: the HTTP requester, a browser or an Agent Client, that started the Authentication Request and will hold the application session; the Authorization Code is delivered to it (Section 5.3). An Agent Client is often also the Session Holder.
- **Sign-in Transaction** (transaction): the Issuer-side record of one Authentication Request from creation until a code or an error is delivered (Section 6).
- **Transaction Resource**: the JSON representation of a transaction (Section 6.1).
- **Consent Record**: the Issuer's record that an Agent accepted a Relying Party's disclosure for a set of scopes (Section 6.4).
- **Account**: the relationship between one Agent and one Relying Party, created at the first successful sign-in (Section 7.4).
- **Open Client**: a Relying Party identified by a Client ID Metadata Document, without registration (Section 4.2).
- **Registered Client**: a Relying Party registered with the Issuer (Section 4.3).
- **Owner Credential**: a bearer credential the Issuer gives the Owner after the Owner authenticated by a method of Section 7.5.
- **Delegated Credential**: a bearer credential the Owner derives from an Owner Credential for an Agent, limited to the operations Section 7.8 marks as delegable. How either credential is obtained is beyond the scope of this specification.

IMPORTANT NOTE TO READERS: the definitions in this section are normative and apply throughout.

### 1.3 Overview

A sign-in proceeds as follows:

1. The Relying Party sends the Session Holder to the Issuer's Authorization Endpoint with an Authentication Request (Section 5.1).
2. The Issuer creates a Sign-in Transaction, binds the Session Holder to it, and answers with the Transaction Resource or with a wait page that embeds it (Section 5.3).
3. The Agent Client reads the transaction, signs its challenge with the Agent Key and posts the assertion (Section 6.3).
4. The Issuer verifies the key, the Account, the per-owner cap, the Owner's policy and the Consent Record, and sets the transaction's status (Sections 6.2, 6.3): `ready`, or `awaiting_owner` or `awaiting_consent` when an approval or a review is still needed.
5. The Session Holder follows the continue step and is redirected to the Relying Party with an Authorization Code (Section 6.5).
6. The Relying Party exchanges the code at the Token Endpoint and validates the ID Token (Sections 5.6, 5.7).

```
+---------------+   (1) Authentication Request    +--------+
| Relying Party | ------------------------------> |        |
|               | <---- (5) code, state, iss ---- | Issuer |
|               | --- (6) code -> ID Token -----> |        |
+---------------+                                 +--------+
                                                   ^      ^
                 (3) signed assertion over challenge      | (4) approval,
                   +--------------+ -------------------+  |     when required
                   | Agent Client |                       |
                   +--------------+                 +---------+
                                                    |  Owner  |
                                                    +---------+
```

Step 1 is reached from the Relying Party's sign-in page or from an Agent Client that starts at the Relying Party (Section 5.8). Steps 2 to 5 need no browser.

### 1.4 Relationship to OpenID Connect

This document profiles OpenID Connect Core 1.0: Authorization Code Flow only, PKCE with `S256` [RFC7636], ES256 signatures, short-lived tokens, no Refresh Tokens (Section 5.6), Issuer identification on the redirect [RFC9207], and Client ID Metadata Documents [CIMD] for unregistered Relying Parties. Sections 3 to 5 use OpenID Connect messages unchanged; the Relying Party additions are steps 6 and 7 of Section 5.7 and Section 9. Sections 6 and 7 define the Agent side, which OpenID Connect leaves to the provider. Appendix B maps this profile to one deployed service.

Beyond the scope of this specification: delegation chains between agents, payments, reputation or trust scores, mail delivery to a handle, how Agents and Owners are created at an Issuer, how an Owner authenticates to an Issuer, how an Issuer stores keys, and how Agent Clients discover Relying Parties.

### 1.5 Constants

| Name | Value | Meaning |
| --- | --- | --- |
| T_TXN | 300 s | Lifetime of a Sign-in Transaction from creation (Section 5.3) |
| T_OWNER | 86400 s | Maximum lifetime of a transaction extended while `awaiting_owner` (Section 6.6) |
| T_CODE | 60 s | Lifetime of an Authorization Code (Section 5.4) |
| T_TOKEN | 600 s | Lifetime of ID Tokens and Access Tokens (Section 5.6) |
| T_ASSERT | 300 s | Maximum `exp` minus `iat` of an assertion or enrollment proof (Sections 6.3, 7.2) |
| T_SKEW | 60 s | Clock tolerance applied to `iat` (Sections 5.7, 6.3) |
| T_KEY | 2592000 s (30 days) | Default Agent Key lifetime (Section 7.1) |
| T_KEY_MAX | 31536000 s (365 days) | Maximum Agent Key lifetime (Section 7.1) |
| T_CONSENT | 180 days | Maximum Consent Record lifetime after last use (Section 6.4) |
| T_RETAIN | 300 s | Minimum time a terminal transaction remains readable (Section 6.2) |
| T_CACHE | 86400 s | Maximum caching of a discovery result (Section 2.2) |
| N_ENTROPY | 128 bits | Minimum entropy of identifiers, challenges, `state`, `nonce` and tokens defined here |
| N_ASSERTION | 2048 octets | Maximum size of an assertion or proof |
| N_CIMD | 16 KiB | Maximum size of a Client ID Metadata Document |
| N_FETCH | 64 KiB, 10 s | Maximum size and duration of a discovery or metadata fetch (Section 2.2) |

## 2. Agent Handles and Issuer Discovery

A handle names an Agent. The domain of the handle names the Home Issuer by publishing a WebFinger resource (Section 2.2) or, failing that, a DNS record (Section 2.3). Section 2.5 states which party performs this discovery and when.

### 2.1 Handle Syntax

```
handle  = local "@" domain
local   = dot-atom-text          ; Section 3.2.3 of [RFC5322], ASCII only
domain  = <domain name per Section 2.3.1 of [RFC1035], as A-labels>
```

The `local` part is limited to 64 octets and the handle to 254 octets. Internationalised local parts [RFC6530] are not supported in this version. Two handles are equal when their `local` parts are octet-for-octet equal and their domains are equal after conversion to lower-case A-labels. An Issuer SHOULD register `local` parts in lower case. The corresponding URI is `acct:` followed by the handle [RFC7565]. A handle is a name; it does not imply that mail delivery to that address works.

### 2.2 WebFinger Lookup

The requester sends the following query to the handle's domain over HTTPS:

```
GET /.well-known/webfinger?resource=acct%3Ascout%40example.com
    &rel=http%3A%2F%2Fopenid.net%2Fspecs%2Fconnect%2F1.0%2Fissuer HTTP/1.1
Host: example.com
```

The response is a JRD. The `href` of the first link whose `rel` is `http://openid.net/specs/connect/1.0/issuer` is the Issuer Identifier, as in Section 2 of [OpenID.Discovery]. The `href` MUST be an `https` URL without query or fragment; otherwise the lookup has failed. If the certificate is invalid, the status is 4xx or 5xx, or the connection fails, the lookup has failed; it MUST NOT be retried over HTTP. A `404`, or a JRD without a matching link, permits the DNS fallback of Section 2.3. A domain MAY delegate by answering with a 3xx status and a `Location` on another host (Section 7 of [RFC7033]); the requester MUST follow at most five redirects and MUST require HTTPS at each hop.

For every fetch in this section, in Section 2.4 and of a JWK Set, the requester MUST NOT connect to a special-use address [RFC6890], MUST re-check the resolved address at every redirect hop, MUST limit the response to N_FETCH, and MUST send no credentials. The requester MUST verify that the `issuer` member of the metadata fetched from `{href}/.well-known/openid-configuration` equals `href`. Results are cached per HTTP caching rules for at most T_CACHE.

### 2.3 DNS Fallback

When Section 2.2 permits it, the requester MAY query the TXT record at `_agentlogin.{domain}`:

```
_agentlogin.example.com.  IN TXT  "v=agentlogin1; iss=https://issuer.example"
```

The requester MUST accept the record only when the response was DNSSEC-validated, locally or by a validating resolver reached over a trusted channel; an unvalidated record MUST be discarded. `iss` MUST be an `https` URL without query or fragment. A record without `v=agentlogin1`, or with more than one `iss`, MUST be ignored. The requester MUST then fetch the Issuer's metadata (Section 2.4) and check that `handle_domains` contains the domain; this protects an Issuer against designation without its consent. WebFinger takes precedence when both exist.

### 2.4 Issuer Metadata

An Issuer MUST publish metadata at `{Issuer Identifier}/.well-known/openid-configuration` per [OpenID.Discovery] and [RFC8414] with the following values:

- `response_types_supported`: MUST contain `code` and SHOULD contain nothing else.
- `grant_types_supported`: `["authorization_code"]`.
- `code_challenge_methods_supported`: MUST contain `S256`; MUST NOT contain `plain`.
- `id_token_signing_alg_values_supported`: MUST contain `ES256`; MAY contain `EdDSA`; MUST NOT contain `none`.
- `agent_key_algs_supported`: REQUIRED. JWS algorithms accepted in assertions and enrollment proofs; MUST contain `ES256`; MAY contain `EdDSA`.
- `subject_types_supported`: MUST contain `public`; MAY contain `pairwise`.
- `authorization_response_iss_parameter_supported`: `true`.
- `client_id_metadata_document_supported`: `true`.
- `scopes_supported`: MUST contain `openid`, `email`, `profile`, `owner_profile` and `owner_email`.
- `token_endpoint_auth_methods_supported`: MUST contain `none` and `client_secret_basic`; MAY contain `client_secret_post`; SHOULD contain `private_key_jwt`.
- `transaction_endpoint`: REQUIRED. HTTPS URL under which Transaction Resources are served (Section 6.1).
- `agents_endpoint`: REQUIRED. HTTPS URL under which Agent management resources are served (Section 7.8).
- `handle_domains`: REQUIRED. JSON array of domains the Issuer serves, as lower-case A-labels; a leading `*.` matches one or more subdomain labels. A Relay that serves no domains publishes `[]`.
- `home_issuers`: REQUIRED for a Relay (Section 8.5), absent otherwise. JSON array of Issuer Identifiers the Relay accepts, or `["*"]` when it accepts any Home Issuer that passes its published rule.
- `op_policy_uri`: REQUIRED for a Relay [RFC8414]; RECOMMENDED otherwise.
- `agent_login_versions_supported`: REQUIRED. JSON array of strings; this document defines `1.0`.

An Issuer MUST NOT publish an `end_session_endpoint`; sessions belong to the Relying Party.

### 2.5 Binding a Handle to its Issuer

An Issuer MUST NOT issue an `email` Claim for a handle whose domain is not in its `handle_domains`; a Relay MUST NOT issue one unless the Home Issuer named in `home_iss` issued it in the upstream ID Token (Section 8.3).

A Relying Party MUST verify, for every ID Token carrying an `email` Claim, that discovery for the handle's domain (Sections 2.2, 2.3) yields a value equal to the token's `iss`. A token carrying `home_iss` MUST be rejected unless `iss` is an Issuer the Relying Party has configured as a Relay; for such a token the discovered value MUST equal `home_iss`, and `home_iss` MUST satisfy that Relay's `home_issuers`. Discovery MAY be cached per Section 2.2.

## 3. The ID Token and UserInfo Response

The ID Token is as defined in Section 2 of [OpenID.Core] with the Claims and constraints below. Which Claims a scope delivers is given in Section 4.1.

### 3.1 Claims

- `iss`: REQUIRED. Issuer Identifier of the Issuer that signed the token.
- `sub`: REQUIRED. Opaque identifier of the Agent: a base64url string of at least N_ENTROPY, stable for one Agent at every Relying Party (`public` subject type), different for every Agent, and never derivable from the handle. Deleting an Agent and creating one with the same handle MUST produce a new value.
- `aud`: REQUIRED. The Relying Party's `client_id`, as a single string.
- `exp`, `iat`: REQUIRED. `exp` minus `iat` MUST NOT exceed T_TOKEN.
- `jti`: REQUIRED. Unique identifier of this token.
- `nonce`: REQUIRED. The value from the Authentication Request (Section 5.1).
- `actor_type`: REQUIRED. Value MUST be `agent`.
- `scope`: REQUIRED. Space-delimited scope values granted in this sign-in [RFC8693].
- `email`: The Agent Handle. `email_verified`: MUST be `true`; it MUST be `true` only if the handle's domain is in the `handle_domains` of the Issuer, or of the Home Issuer named in `home_iss`, and the Agent was enabled when the token was minted. An Issuer MUST NOT issue these Claims otherwise.
- `name`: Display name of the Agent; omitted when none is set.
- `preferred_username`: Short name of the Agent, not guaranteed unique.
- `owner_sub`: Opaque identifier of the Owner with the same syntax as `sub`, identical for every Agent of one Owner at every Relying Party of one Issuer and never derivable from the Owner's address. Values from different Issuers are not comparable.
- `owner_name`: Display name of the Owner.
- `owner_email`: Address of the Owner. `owner_email_verified`: MUST be `true`; an Issuer that cannot assert it MUST NOT issue these Claims.
- `owner_verified_via`: REQUIRED when `owner_name` or `owner_email` is present. One value of Section 7.5, as a single string.
- `home_iss`: REQUIRED in a token issued by a Relay (Section 8); MUST NOT appear otherwise. Issuer Identifier of the Home Issuer.

Claims that were not granted MUST be omitted; they MUST NOT be present with `null` or an empty value. The ID Token MAY contain other Claims. Claims that are not understood MUST be ignored.

### 3.2 Signing

The ID Token MUST be a JWS signed with `ES256` [RFC7518]; an Issuer MAY additionally offer `EdDSA` with Ed25519 [RFC8037] when advertised in its metadata. The JOSE header MUST contain `alg` and `kid`, SHOULD contain `typ` with the value `JWT`, and MUST NOT contain `jwk`, `jku`, `x5u` or `x5c`. The signing key MUST be published in the Issuer's JWK Set under that `kid` (Section 7.7).

### 3.3 UserInfo and Live State

The UserInfo Endpoint returns the Claims of Section 3.1 other than `aud`, `exp`, `iat`, `jti` and `nonce`, as a JSON object, for a valid Access Token presented as a bearer token [RFC6750]. The `sub` value MUST equal the ID Token's. The Issuer MUST evaluate the Agent's current state on every request and MUST answer `401` with `WWW-Authenticate: Bearer error="invalid_token"` once the Agent Key that asserted the sign-in is revoked or expired, the Agent is deleted or disabled, or the Account is disabled, even if the Access Token has not expired.

### 3.4 Example

The following is a non-normative example of the Claims in an ID Token issued to the Registered Client `s6BhdRkqt3`, which requested `openid email profile owner_email`:

```json
{
  "iss": "https://issuer.example",
  "sub": "b1Ykm9wQ2tN0cJ6vR8dLxA5hZ3pS7uE4gF1iT2oW9qM",
  "aud": "s6BhdRkqt3",
  "exp": 1791600660,
  "iat": 1791600060,
  "jti": "9f1c2a44-3e77-4c19-9a2e-6b0d5f8e1c33",
  "nonce": "Vb7kQ2mR9tL4xN1cW8sJyA",
  "actor_type": "agent",
  "scope": "openid email profile owner_email",
  "email": "scout@example.com",
  "email_verified": true,
  "name": "Scout",
  "preferred_username": "scout",
  "owner_sub": "oV3nJ8dK1qT6xB2mZ9cL4rH7yP0sA5wE8uG1fI2kN3M",
  "owner_email": "jane@example.com",
  "owner_email_verified": true,
  "owner_verified_via": "email"
}
```
## 4. Scopes and Client Tiers

### 4.1 Scope Values

Scope values are space-delimited in the `scope` parameter. Scope values not listed here MAY be present and MUST be ignored by the Issuer unless defined by an extension.

| Scope | Tier | Claims delivered |
| --- | --- | --- |
| `openid` | all | REQUIRED in every request; `sub` and the Claims every token carries (Section 3.1) |
| `email` | all | `email`, `email_verified` |
| `profile` | all | `name` (if set), `preferred_username`, `owner_sub` |
| `owner_profile` | Registered Clients | `owner_name`, `owner_verified_via` |
| `owner_email` | Registered Clients | `owner_email`, `owner_email_verified`, `owner_verified_via` |

### 4.2 Open Clients

An Open Client identifies itself with a `client_id` that is the HTTPS URL of its Client ID Metadata Document [CIMD]. The URL MUST satisfy Section 3 of [CIMD]: `https` scheme, a non-empty path, no userinfo, no fragment, no `.` or `..` path segments; the Issuer MUST reject other values with `invalid_request` without fetching. The document MUST contain `client_id` equal to that URL, `redirect_uris`, and `token_endpoint_auth_method` with the value `none`; it SHOULD contain `client_name`, `logo_uri`, `tos_uri`, `policy_uri` and `initiate_login_uri`. The Issuer MUST fetch the document when it first sees the `client_id` and on cache expiry, applying the protections of Section 2.2; it MUST NOT follow redirects, MUST require a JSON content type and a `200` status, MUST reject documents larger than N_CIMD, MUST compare the document's `client_id` with the `client_id` parameter and with the fetched URL, and MAY cache per HTTP caching rules. The `redirect_uri` of a request MUST exactly match one of `redirect_uris`; `http` and loopback redirect URIs MUST NOT be accepted. An Open Client MAY request `openid`, `email` and `profile`; a request containing `owner_profile` or `owner_email` MUST fail with `invalid_scope`.

Note: this is the model of IndieAuth [IndieAuth], where a client is its URL; a bare origin without a metadata document is not accepted by this profile.

### 4.3 Registered Clients

A Registered Client is created by Dynamic Client Registration [RFC7591] presented with an initial access token, or by a mechanism the Issuer operates; an Issuer MUST support at least one of these. The Issuer assigns an opaque `client_id` and either a `client_secret` or accepts a JWK Set for `private_key_jwt` [RFC7523]. A Registered Client authenticates at the Token Endpoint with one of `client_secret_basic` [RFC7617], `client_secret_post` or `private_key_jwt` (RECOMMENDED) as advertised in the Issuer's metadata, MAY register loopback redirect URIs for development [RFC8252], MAY request `owner_profile` and `owner_email`, and MUST publish `tos_uri` and `policy_uri` when it requests `owner_email`. PKCE is REQUIRED for Registered Clients as for Open Clients (Section 5.1).

### 4.4 Client Metadata Defined by this Specification

The following client metadata are defined for use in Client ID Metadata Documents and in registration requests:

- `max_signups_per_owner`: OPTIONAL. Integer from 0 to 1000000. Maximum number of Accounts the Issuer creates for Agents of one Owner at this client (Section 7.6). Absent means unlimited; `0` pauses new sign-ups while existing Accounts continue to sign in.
- `require_review`: OPTIONAL. Boolean, default `false`. When `true`, every sign-in at this client includes the review step of Section 6.4.
- `initiate_login_uri`: OPTIONAL. As defined in [OpenID.Registration]; used by Agent-initiated start (Section 5.8).

## 5. Authentication

Communication with every endpoint of Sections 5 to 7 MUST use TLS per BCP 195 [BCP195]. Every non-redirect response of Sections 5 to 7 MUST carry `Cache-Control: no-store`.

### 5.1 Authentication Request

The Relying Party sends the Session Holder to the Authorization Endpoint with the following parameters in the query component, encoded as `application/x-www-form-urlencoded`:

- `response_type`: REQUIRED. Value MUST be set to `code`.
- `client_id`: REQUIRED. The Open Client's document URL or the Registered Client's identifier.
- `redirect_uri`: REQUIRED.
- `scope`: REQUIRED. MUST contain `openid`.
- `state`: REQUIRED. Opaque value of at least N_ENTROPY, bound to the Session Holder's session at the Relying Party.
- `nonce`: REQUIRED. Opaque value of at least N_ENTROPY, returned in the ID Token.
- `code_challenge`, `code_challenge_method`: REQUIRED for every client. `code_challenge_method` MUST be `S256` [RFC7636].
- `prompt`: OPTIONAL. With `consent` the Issuer MUST perform the review step (Section 6.4). With `none` a request that would need a review MUST fail with `consent_required` and one that would need an Owner approval (Section 6.6) MUST fail with `interaction_required`. Other values MUST be ignored.
- `login_hint`: OPTIONAL. The Agent Handle expected to sign in. A Relay uses it to find the Home Issuer (Section 8).

`max_age`, `claims`, `request` and `request_uri` are not supported and MUST be ignored. The following is a non-normative example (with line wraps for display only):

```
GET /authorize?response_type=code
    &client_id=https%3A%2F%2Fclient.example.org%2Fclient-metadata.json
    &redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb
    &scope=openid%20email%20profile
    &state=Yq3nXr8vL2kT5wB9mC1dPz&nonce=Vb7kQ2mR9tL4xN1cW8sJyA
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    &code_challenge_method=S256 HTTP/1.1
Host: issuer.example
Accept: application/json
```

### 5.2 Request Validation

The Issuer MUST:

1. Resolve `client_id` to a Registered Client, or fetch and validate its Client ID Metadata Document (Section 4.2).
2. Verify that `redirect_uri` exactly matches a registered or documented value. If it does not, the Issuer MUST NOT redirect and MUST answer `400` directly: with the JSON error body of Section 6.7 and `error` `invalid_request` when the request prefers `application/json` (Section 5.3), otherwise as HTML.
3. Reject the request with `invalid_request` if `response_type`, `state`, `nonce`, `code_challenge` or `code_challenge_method` is missing or invalid, or if any parameter is repeated.
4. Reject with `invalid_scope` a scope the client's tier does not permit.

### 5.3 Transaction Creation and Session Binding

On a valid request the Issuer creates a Sign-in Transaction (Section 6) with lifetime T_TXN and a transaction identifier of at least N_ENTROPY, and binds the Session Holder to it. The response depends on the request's `Accept` header, evaluated per Section 12.5.1 of [RFC9110]; an absent header or `*/*` is treated as `text/html`:

- When `application/json` is the highest-weighted acceptable type and outranks `text/html`, the Issuer MUST respond `200` with the Transaction Resource (Section 6.1) including a `session_token`: a bearer credential of at least N_ENTROPY, bound to this transaction, that identifies the Session Holder in Section 6.5.
- Otherwise the Issuer MUST respond `303` to a wait page. The Issuer MUST bind the Session Holder with a session cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, path limited to the Issuer's own resources) that identifies it in Section 6.5. The `200` response of the wait page MUST carry a `Link` header `<{url}>; rel="agent-login-transaction"` naming the Transaction Resource, and its HTML MUST contain `<script type="application/json" id="agent-login-transaction">` whose text is the Transaction Resource as of page generation, serialised with `<`, `>`, `&`, U+2028 and U+2029 escaped as `<`, `>`, `&`, ` ` and ` `. The `303` MAY carry the same `Link` header. The wait page SHOULD poll the Transaction Resource and follow the continue step when the status becomes terminal.

Every HTML page the Issuer serves to a user agent, including wait, review and Owner approval pages, MUST be sent with a `Content-Security-Policy` that permits only the Issuer's own scripts and sets `frame-ancestors 'none'`. Client-supplied strings MUST be rendered as text, and `logo_uri`, `tos_uri` and `policy_uri` MUST be `https` URLs or MUST be dropped.

### 5.4 Successful Response

When the transaction reaches `completed` (Section 6.5), the Issuer redirects the Session Holder to `redirect_uri` with:

- `code`: REQUIRED. Authorization Code, single use, valid for T_CODE.
- `state`: REQUIRED. The request's value.
- `iss`: REQUIRED. The Issuer Identifier [RFC9207].

A code presented twice MUST be refused with `invalid_grant`, and the Issuer SHOULD revoke tokens already issued for it.

### 5.5 Error Response

Errors are returned per Section 4.1.2.1 of [RFC6749] with `error`, OPTIONAL `error_description` and `error_uri`, `state` and `iss`, to a validated `redirect_uri` only, when the transaction's continue step is followed (Section 6.5). Error codes are those of [RFC6749], `interaction_required`, `login_required` and `consent_required` from Section 3.1.2.6 of [OpenID.Core], and:

- `signup_limit_reached`: the Owner of the asserting Agent has reached `max_signups_per_owner` at this client, or the client has set it to `0`.

Transaction outcomes map to errors as follows:

| Status, `reason` | `error` | `error_description` |
| --- | --- | --- |
| `denied`, `cancelled` | `access_denied` | absent |
| `denied`, `access_denied` | `access_denied` | absent |
| `denied`, `key_revoked` | `access_denied` | absent |
| `denied`, `owner_declined` | `access_denied` | `owner_declined` |
| `denied`, `consent_required` | `consent_required` | absent |
| `denied`, `interaction_required` | `interaction_required` | absent |
| `denied`, `signup_limit_reached` | `signup_limit_reached` | absent |
| `expired` | `access_denied` | `transaction_expired` |

### 5.6 Token Request and Response

The Relying Party presents `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier` and, for an Open Client, `client_id`; a Registered Client authenticates per Section 4.3. The Issuer MUST verify that the code was issued to the authenticated Registered Client or to the presented Open Client `client_id` [RFC6749 Section 4.1.3], that `redirect_uri` equals the request's, and that `code_verifier` matches the challenge; it MUST answer `invalid_grant` when any of these fails, when `code_verifier` is absent, or when the code is unknown, expired, used, or belongs to a transaction whose asserting key was revoked (Section 7.3). The successful response is per Section 3.1.3.3 of [OpenID.Core] with `access_token`, `token_type` `Bearer`, `expires_in` (T_TOKEN), `id_token` and `scope`, all REQUIRED. The Issuer MUST NOT issue Refresh Tokens. The Access Token is opaque to the Relying Party, MUST expire T_TOKEN after issue, and MUST be accepted only at the UserInfo Endpoint.

### 5.7 ID Token Validation

The Relying Party MUST validate the response in the following manner:

1. Verify that the redirect contains `iss` and that it equals the Issuer Identifier recorded for this `state` when the request was sent [RFC9207 Section 2.4]; reject a response without `iss`. Verify that `state` equals the value bound to the session and consume it. Send the Token Request only to that recorded Issuer's Token Endpoint.
2. Verify the JWS signature with the key named by `kid` in the Issuer's JWK Set, refetching the JWK Set once when `kid` is unknown. `alg` MUST be in the Relying Party's configured set, which SHOULD be `ES256` alone or with `EdDSA`, and MUST match the key's type: `ES256` only with `kty` `EC` and `crv` `P-256`, `EdDSA` only with `kty` `OKP` and `crv` `Ed25519`.
3. Verify that `iss` equals the recorded Issuer Identifier and `aud` equals the `client_id`.
4. Verify that the current time is before `exp` and not more than T_SKEW before `iat`.
5. Verify that `nonce` equals the request's value.
6. Verify that `actor_type` equals `agent`.
7. When `email` is present, verify the binding of Section 2.5, including the `home_iss` rule.

If any of the listed steps fail, the ID Token MUST be rejected.

### 5.8 Agent-Initiated Start

An Agent Client that wants to sign in at a Relying Party without first visiting its sign-in page sends the Session Holder to the client's `initiate_login_uri` with the parameters `iss` and `login_hint` as defined in Section 4 of [OpenID.Core]. The Relying Party MUST verify that `iss` equals an Issuer it is configured to accept and MUST refuse the request with `400` otherwise, performing no discovery or fetch for an unconfigured `iss`; it then starts an Authentication Request to that Issuer carrying the same `login_hint` and records the Issuer for the `state` as Section 5.7 requires. How an Agent Client learns that a Relying Party accepts Agent Login is beyond the scope of this specification; [RFC9728] and [auth.md] are two discovery mechanisms in use.
## 6. The Sign-in Transaction

This section defines the Agent side of the sign-in as a resource with explicit statuses. Every response in this section, including error responses for an existing transaction, MUST carry the current `status` and the `next` step. Requests from an Agent Client to the transaction endpoint carry no cookies and need no anti-forgery token: the assertion signature, the `transaction_token` and the `session_token` are its only authorities. The Session Holder bound under Section 5.3 additionally receives the continue URL (Section 6.5). Agent Clients MUST validate server certificates and MUST NOT follow a redirect from HTTPS to HTTP. An Issuer that supports browser-based Agent Clients on other origins MUST answer CORS preflight requests for the transaction and agents endpoints.

### 6.1 Transaction Resource

`GET {transaction_endpoint}/{transaction_id}` with `Accept: application/json` returns:

- `transaction_id`: REQUIRED. The identifier. Possession of it MUST grant nothing beyond reading this representation.
- `iss`: REQUIRED. Issuer Identifier of the Issuer serving the transaction.
- `url`: REQUIRED. Absolute HTTPS URL of this Transaction Resource.
- `status`: REQUIRED. One of the values in Section 6.2. Not to be confused with the `state` parameter of Section 5.1.
- `next`: REQUIRED. Object with `action` (Section 6.2); `method` and `url` (absolute HTTPS URL), REQUIRED unless `action` is `none`, `url` additionally withheld as described in Section 6.5; `retry_after` (seconds), REQUIRED when `action` is `await_owner` or `follow` and OPTIONAL otherwise.
- `expires_at`: REQUIRED. Expiry of the transaction, seconds since 1970-01-01T00:00:00Z.
- `client`: REQUIRED. Object with `client_id`, `client_type` (`open` or `registered`), `redirect_host`, and the client's `client_name`, `logo_uri`, `tos_uri` and `policy_uri` when known.
- `requested_scopes`: REQUIRED. Array of scope values.
- `disclosure`: REQUIRED. Array of objects `{scope, title, description}`, one per requested scope, describing what the client receives. It MUST NOT change during the transaction's lifetime.
- `requester`: OPTIONAL. Object describing the Session Holder as seen by the Issuer: `user_agent` and `network` (a coarse network location), as strings, for the Agent to inspect before asserting.
- `challenge`: REQUIRED while `status` is `awaiting_agent` and `next.action` is `assert`. Opaque value of at least N_ENTROPY, single use.
- `consent_reason`: REQUIRED while `status` is `awaiting_consent`. One of `first_visit`, `material_change`, `expired`, `prompt_consent`, `policy` (Section 6.4).
- `login_hint`: OPTIONAL. The handle named in the Authentication Request.
- `reason`: REQUIRED when `status` is `denied`. One of `cancelled`, `access_denied`, `key_revoked`, `owner_declined`, `consent_required`, `interaction_required`, `signup_limit_reached`.
- `transaction_token`: present only in the response to a successful assertion (Section 6.3) or, at a Relay, as Section 8.4 describes.
- `session_token`: present only in the `200` response of Section 5.3.

Members not understood MUST be ignored.

### 6.2 Statuses and Next Steps

| Status | Terminal | `next.action` | Set by |
| --- | --- | --- | --- |
| `awaiting_agent` | no | `assert`; at a Relay `identify` or `follow` (Section 8.4) | creation |
| `awaiting_owner` | no | `await_owner` | Section 6.3 step 10, Section 6.4 |
| `awaiting_consent` | no | `review` | Section 6.3 step 10, Section 6.6 |
| `ready` | no | `continue` | Sections 6.3, 6.4, 6.6 |
| `completed` | yes | `none` | Section 6.5 |
| `denied` | yes | `continue` | Sections 6.3, 6.4, 6.6, 7.3, 7.4 |
| `expired` | yes | `continue` | expiry of `expires_at` |

`next.action` values: `assert` (POST an assertion, Section 6.3), `review` (POST a decision, Section 6.4), `await_owner` (GET the transaction again after `retry_after`), `continue` (GET the continue URL, Section 6.5), `identify` and `follow` (Relays only, Section 8.4), and `none`. A terminal transaction MUST remain readable with `200` for at least T_RETAIN; the Issuer MAY then answer `404` `invalid_transaction`.

### 6.3 Assertion

The Agent Client first verifies that the resource's `iss` equals the Home Issuer discovered for its handle (Section 2) and that `url` and `next.url` are under that Issuer's `transaction_endpoint`. It then posts to the URL given for `assert`:

```
POST /transactions/3oQ7vK1dR8bN2mL9xA5yZw/assertion HTTP/1.1
Host: issuer.example
Content-Type: application/json

{"assertion": "eyJhbGciOiJFUzI1NiIs...[omitted for brevity]..."}
```

The assertion and the enrollment proof of Section 7.2 are JWSs with the following contents:

| Member | Assertion | Enrollment proof |
| --- | --- | --- |
| header `alg` | REQUIRED. A value of `agent_key_algs_supported` matching the key's type (`ES256` with `EC`/`P-256`, `EdDSA` with `OKP`/`Ed25519`) | same |
| header `typ` | REQUIRED. `agent-login+jwt` | REQUIRED. `agent-login-enrollment+jwt` |
| header `kid` | REQUIRED. The Agent Key identifier (Section 7.1) | REQUIRED. The pending key's identifier |
| header `jwk`, `jku`, `x5u`, `x5c`, `crit` | MUST NOT be present | same |
| `iss`, `sub` | REQUIRED. Both the Agent Handle | same |
| `aud` | REQUIRED. The Issuer Identifier | same |
| `txn` | REQUIRED. The transaction identifier [RFC8417] | absent |
| `nonce` | REQUIRED. The transaction's `challenge` | REQUIRED. The key's enrollment `challenge` |
| `iat`, `exp` | REQUIRED. `exp` MUST NOT exceed `iat` plus T_ASSERT | same |
| `jti` | REQUIRED. Unique per JWS | same |
| `accept_disclosure` | OPTIONAL. Boolean. `true` accepts the transaction's `disclosure` for `requested_scopes` | absent |
| `deliver_to_session` | OPTIONAL. Boolean, default `false`. `true` permits delivery of the result to the Session Holder bound under Section 5.3 (Section 6.5) | absent |
| size | MUST NOT exceed N_ASSERTION | same |

When an assertion is received, the Issuer MUST perform the following procedure, stopping at the first step that sets `status`:

1. Verify that the compact serialization does not exceed N_ASSERTION; parse it; verify `typ`, that `alg` is permitted, and that no forbidden header parameter is present.
2. Resolve `kid` to an Agent Key with status `active` enrolled for the handle in `iss` (equality per Section 2.1); verify that the handle's domain is in `handle_domains` and that `alg` matches the key's type.
3. Verify the signature with that key.
4. Verify that `aud` equals the Issuer Identifier, `txn` equals the transaction identifier, `nonce` equals the current `challenge`, `exp` has not passed, and `iat` is neither more than T_ASSERT in the past nor more than T_SKEW in the future.
5. If `login_hint` was given and differs from the handle (Section 2.1), fail with `invalid_assertion`.
6. If an assertion was already accepted for this transaction, fail with `assertion_replayed`.
7. Consume the `challenge` and record the assertion as the sign-in's authentication event.
8. If the Account for (Agent, `client_id`) is disabled, set `status` to `denied` with `reason` `access_denied`.
9. If no Account exists and the Owner's count at this client is not below `max_signups_per_owner` (Section 7.6), set `status` to `denied` with `reason` `signup_limit_reached`.
10. Determine the outstanding gates: an Owner approval is outstanding when the request includes `owner_profile` or `owner_email` and the key lacks the `share_owner` permission (Section 6.6); a review is outstanding when Section 6.4 requires one and `accept_disclosure` is not `true`, or when `accept_disclosure` is `true` but Section 6.4 requires a review for a reason other than the Consent Record. If `prompt` was `none` and a review is outstanding, set `status` to `denied` with `reason` `consent_required`; if `prompt` was `none` and an Owner approval is outstanding, set `status` to `denied` with `reason` `interaction_required`. Otherwise, if `accept_disclosure` is `true` and no review is outstanding, create or renew the Consent Record; then set `status` to `awaiting_owner` if an Owner approval is outstanding, else to `awaiting_consent` if a review is outstanding, else to `ready`.

If any of steps 1 to 6 fails, the assertion MUST be rejected with the matching error of Section 6.7, and neither `status` nor `challenge` changes. Otherwise the Issuer answers `200` with the Transaction Resource; when the status is not terminal the resource includes `transaction_token`: a bearer credential of at least N_ENTROPY, bound to this transaction and this key, returned once, valid until the transaction becomes terminal or the key is revoked, and presented as `Authorization: Bearer {transaction_token}` on later requests to the transaction's resources, including `GET` of the Transaction Resource. The Issuer MUST NOT set `status` to `ready` while an Owner approval or a review is outstanding.

### 6.4 Review and Consent

A Consent Record stores the handle, the `client_id`, the granted scopes, the client's `redirect_host`, `client_name`, `tos_uri` and `policy_uri`, and the time of last use. The Issuer MUST require a review when any of the following holds, and MUST NOT otherwise:

- no Consent Record exists for (Agent, `client_id`): `consent_reason` `first_visit`;
- a record exists but `requested_scopes` is not a subset of its scopes, or a stored client value changed: `material_change`;
- the record's last use is more than T_CONSENT ago, or the Issuer's shorter period has elapsed: `expired`;
- the request carried `prompt=consent`: `prompt_consent`;
- the client's `require_review` is `true`, or Issuer policy requires it: `policy`.

To decide, the Agent Client posts `{"decision": "allow"}` or `{"decision": "deny"}` to the URL given for `review` with `Authorization: Bearer {transaction_token}`; the session binding of Section 5.3 MUST NOT authorise this step. `allow` creates or renews the Consent Record and sets `status` to `awaiting_owner` if an Owner approval is still outstanding, else `ready`; `deny` sets `status` to `denied` with `reason` `cancelled`. The Issuer answers `200` with the Transaction Resource. Consent revocation is defined in Section 7.8.

### 6.5 Completion

When `status` is `ready`, `denied` or `expired`, `next.url` is a continue URL containing at least N_ENTROPY. The Issuer MUST return it to a requester presenting the `transaction_token`, and to the Session Holder (session cookie or `session_token`) only if the accepted assertion carried `deliver_to_session` `true`; to any other requester the Issuer returns `next.action` `continue` without `url`. A `GET` of the continue URL with `Accept: text/html` (or no `Accept`, or `*/*`) answers `302` to the Relying Party's `redirect_uri` with the parameters of Section 5.4 or 5.5; with `Accept: application/json` it answers `200` with `{"redirect": "<that URL>"}`. For `ready` the Issuer issues the code exactly once and sets `status` to `completed`; a second request answers `410`. For `denied` and `expired` the continue URL MAY be followed more than once. The requester that follows the continue step is the Session Holder: the code is delivered to it.

### 6.6 Owner Approval

When `status` is `awaiting_owner`, the Issuer notifies the Owner by a means of its choosing. The approval or refusal MUST be given within a session in which the Owner authenticated by a method of Section 7.5; a link or code delivered to a mailbox or to any channel readable by the Agent MUST NOT by itself approve. The approval page MUST show the client, including its `redirect_host`, the requested Owner Claims and the Agent Handle. Approval sets `status` to `awaiting_consent` if a review is still outstanding, else `ready`; refusal sets `status` to `denied` with `reason` `owner_declined`. While `status` is `awaiting_owner` the Issuer MAY extend `expires_at` up to T_OWNER after creation; the Agent Client MUST re-read it on every poll. The Issuer MUST NOT issue a token that omits an Owner Claim the client requested: the sign-in either delivers every requested Owner Claim or fails.

### 6.7 Transaction Errors

Errors are returned with an HTTP status and a JSON body `{error, error_description, status, next}`, where `error` is REQUIRED, `error_description` OPTIONAL, and `status` and `next` are present whenever the transaction exists:

- `invalid_request` (400): malformed body or parameters.
- `invalid_transaction` (404): unknown transaction identifier, or a terminal transaction the Issuer no longer retains.
- `transaction_expired` (410): an assertion or decision was posted to, or a `ready` continue URL was followed for, a terminal transaction. A `GET` of a terminal transaction answers `200`.
- `invalid_assertion` (400): the assertion fails step 1, 4 or 5 of Section 6.3.
- `unknown_key` (401): `kid` resolves to no enrolled key for the handle, or the handle's domain is not served.
- `key_revoked` (401): the key exists but is not `active`.
- `invalid_signature` (401): the signature does not verify.
- `assertion_replayed` (409): the transaction already accepted an assertion.
- `invalid_token` (401): the `transaction_token` or `session_token` is missing, wrong or no longer valid.
- `rate_limited` (429): the requester exceeded the Issuer's limits; `Retry-After` MUST be present.

## 7. Agents, Keys, Owners and Caps

### 7.1 Agent Keys

An Agent Key is an ECDSA key on curve P-256 (REQUIRED for Issuers to accept) or an Ed25519 key (OPTIONAL). Its identifier is the RFC 7638 SHA-256 JWK Thumbprint of the public key [RFC7638], base64url-encoded. A key record has:

- `kid`: REQUIRED. The identifier.
- `status`: REQUIRED. `pending` until possession is proved, `active` thereafter, `revoked` after Section 7.3, `expired` after `expires_at`.
- `jwk`: REQUIRED. The public key with exactly the members `kty`, `crv`, `x` and, for P-256, `y`.
- `permissions`: REQUIRED. Object; `share_owner` (boolean, default `false`) allows sign-ins that disclose Owner Claims without an Owner approval.
- `name`: OPTIONAL. Label chosen at enrollment.
- `created_at`, `expires_at`: REQUIRED. Seconds since 1970-01-01T00:00:00Z. `expires_at` defaults to `created_at` plus T_KEY and MUST NOT exceed `created_at` plus T_KEY_MAX.

A key whose `expires_at` has passed MUST be treated as not `active`. An Agent MAY hold several keys; an Issuer MUST allow at least two active keys per Agent so that rotation has no gap. The private key MUST NOT leave the Agent Client; implementations SHOULD store it in an operating-system keystore or a key management service, and MUST NOT place it in model prompts, tool output or logs.

### 7.2 Key Enrollment

`POST {agents_endpoint}/{handle}/keys` with body `{jwk, name, expires_at}` creates a `pending` key. The Issuer MUST reject a `jwk` with any member other than `kty`, `crv`, `x` and (for P-256) `y`, whose `kty` and `crv` are inconsistent, whose curve is not supported, whose point is not on the curve, or, for Ed25519, whose point is the identity or of small order; and MUST reject a public key previously revoked for this handle. `permissions` in the body are ignored; `share_owner` is granted only by the update operation of Section 7.8 with an Owner Credential. The response is `201` with the key record plus `challenge` (at least N_ENTROPY, single use, valid for T_ASSERT) and `proof_url`, an absolute HTTPS URL at the Issuer.

The Agent Client then posts `{"proof": "<JWS>"}` to `proof_url`; this request needs no credential. The Issuer MUST verify that the serialization does not exceed N_ASSERTION, that the header `typ` is `agent-login-enrollment+jwt`, that `kid` equals the pending key's identifier and `alg` matches its type, that no forbidden header parameter is present, that the signature verifies with the pending key's `jwk` and no other key, that `iss` and `sub` equal the handle in the path, that `aud` equals the Issuer Identifier, that `nonce` equals this key's unconsumed `challenge`, and that `exp` and `iat` satisfy the rule of Section 6.3 step 4. On success the Issuer sets `status` to `active` and answers `200` with the key record; on failure it answers with the matching error of Section 6.7. A `pending` key not proved within T_ASSERT MUST be deleted.

Note: generating the key in a browser's Web Cryptography API as non-extractable material and generating it in a command-line tool are both conforming Agent Client designs.

### 7.3 Key Revocation

Revoking a key (Section 7.8) MUST, with immediate effect: refuse assertions and proofs signed with it; set every open transaction it asserted to `denied` with `reason` `key_revoked`; refuse at the Token Endpoint, with `invalid_grant`, every code not yet redeemed from a transaction it asserted; and invalidate every Access Token issued for such a transaction (Section 3.3). Revocation MUST NOT delete Consent Records or Accounts. An Issuer SHOULD offer the Owner one operation that revokes every key of every Agent of that Owner. An Issuer MAY additionally send OpenID Connect Back-Channel Logout [OpenID.BackChannel] or Shared Signals events [OpenID.SSF] to Relying Parties that registered for them.

### 7.4 Accounts

An Account is created at the first `completed` transaction for (Agent, `client_id`). Its record has `client_id`, `status` (`enabled` or `disabled`), `first_signed_in_at`, `last_signed_in_at` and `sign_in_count`. Disabling an Account (Section 7.8) sets open transactions for the pair that passed step 7 of Section 6.3 to `denied` with `reason` `access_denied`, makes later transactions end the same way (step 8), and invalidates its outstanding Access Tokens (Section 3.3); re-enabling restores sign-in and preserves the counters. An Account affects one Relying Party only.

### 7.5 Owner Verification

Before issuing any Owner Claim, the Issuer MUST have verified the Owner by at least one of the following methods, listed from weakest to strongest, and MUST report the strongest one used in `owner_verified_via`:

- `email`: the Owner proved control of `owner_email` by a one-time code or link sent to it. Every Issuer MUST support this method.
- `oidc`: the Owner authenticated through an upstream OpenID Provider that asserted the address with `email_verified` `true`.
- `domain`: the Owner proved control of the domain of `owner_email` by DNS or a well-known resource.
- `passkey`: the Owner authenticated with a WebAuthn credential [WebAuthn] registered after one of the methods above.

An Owner MAY be an organisation with several administrators; `owner_name` and `owner_email` then identify the organisation's designated contact.

### 7.6 Per-Owner Sign-up Caps

A client MAY set `max_signups_per_owner` (Section 4.4). The Issuer counts, per (Owner, `client_id`), every Account ever created, including disabled and deleted Accounts, plus transactions that passed step 9 of Section 6.3 and are not yet terminal, so that deleting Accounts or racing transactions does not free capacity. Agents that already have an Account at the client sign in regardless of the cap.

### 7.7 Issuer Signing Keys and Rotation

The Issuer MUST publish its signing keys as a JWK Set at `jwks_uri`; each key MUST carry a stable `kid`, `use` `sig` and `alg`. To rotate, the Issuer MUST publish the new key before signing with it and MUST keep the previous key in the JWK Set for at least T_TOKEN plus the longest cache lifetime it allows on the JWK Set response. One active signing key per algorithm is RECOMMENDED. Signing keys SHOULD be held in a hardware security module or key management service from which they cannot be exported.

### 7.8 Management Operations

Resources are served under `agents_endpoint`; `{handle}` and `{client_id}` in paths are percent-encoded. Every operation requires `Authorization: Bearer` with an Owner Credential of the Owner of the handle in the path, or a Delegated Credential where marked delegable; the Issuer MUST verify that relationship on every request, MUST answer `401` with `WWW-Authenticate: Bearer error="invalid_token"` [RFC6750] for a missing or invalid credential, `403` `insufficient_permission` for a Delegated Credential on a non-delegable operation, and `404` for a handle that does not exist or does not belong to the credential's Owner.

| Operation | Method and path | Body | Success | Delegable |
| --- | --- | --- | --- | --- |
| Enroll key | `POST .../{handle}/keys` | `{jwk, name, expires_at}` | `201` key record + `challenge`, `proof_url` | yes |
| Prove key | `POST {proof_url}` | `{proof}` | `200` key record | no credential |
| List keys | `GET .../{handle}/keys` | | `200` `{"keys": [...]}` | yes |
| Get key | `GET .../{handle}/keys/{kid}` | | `200` key record | yes |
| Update key | `PATCH .../{handle}/keys/{kid}` | `{name}` and/or `{permissions: {share_owner}}` | `200` key record | `name` only |
| Revoke key | `DELETE .../{handle}/keys/{kid}` | | `204` | yes |
| Revoke all keys | `DELETE .../{handle}/keys` | | `204` | yes |
| List accounts | `GET .../{handle}/accounts` | | `200` `{"accounts": [...]}` | yes |
| Set account status | `PATCH .../{handle}/accounts/{client_id}` | `{"status": "enabled"\|"disabled"}` | `200` account record | yes |
| Revoke consent | `DELETE .../{handle}/consents/{client_id}` | | `204` | yes |

Revoking a consent deletes the Consent Record and MUST NOT affect keys or Accounts.
## 8. Relay Profile

### 8.1 Purpose

A Relay is an Issuer for Relying Parties whose software can configure only one Issuer. It authenticates the Agent at the Agent's Home Issuer and issues its own ID Token. A Relay MUST conform to every requirement on an Issuer except as this section states, MUST publish `handle_domains` as `[]` unless it is also the Home Issuer for some domains, and MUST publish `home_issuers` and `op_policy_uri` (Section 2.4).

### 8.2 Upstream Authentication

On an Authentication Request the Relay MUST obtain the handle from `login_hint` or through the `identify` step of Section 8.4, perform discovery (Section 2), refuse a Home Issuer that is not accepted by `home_issuers` or whose metadata lacks a REQUIRED member of Section 2.4, and run an Authentication Request of its own against the Home Issuer on the JSON path of Section 5.3, with its own `redirect_uri`, `state`, `nonce` and PKCE, binding the upstream `state` to its transaction and keeping the upstream `session_token`. The Relay MUST request `profile` upstream on every request, so that it obtains `owner_sub` for Section 7.6, and MUST request the Owner scopes only when the Relying Party requested them; a Relay that is not a Registered Client at the Home Issuer MUST fail a request containing `owner_profile` or `owner_email` with `invalid_scope` before contacting the Home Issuer. The Relay MUST validate the upstream ID Token per Section 5.7, including Section 2.5. The Relay MUST NOT set `max_signups_per_owner` in its own client metadata at a Home Issuer; it enforces Section 7.6 itself per (Owner, Relying Party `client_id`), identifying the Owner by (`home_iss`, upstream `owner_sub`).

### 8.3 Derived Subjects and Claim Mapping

The Relay MUST set `sub` to `base64url(SHA-256("agent-login-sub|" || home_iss || "|" || upstream sub))` and `owner_sub` to `base64url(SHA-256("agent-login-owner|" || home_iss || "|" || upstream owner_sub))`, each input UTF-8 encoded; MUST copy `email`, `email_verified`, `name`, `preferred_username` and `actor_type` from the upstream ID Token; MUST copy the Owner Claims and `owner_verified_via` only when the Home Issuer delivered them; MUST omit `owner_sub`, `name` and `preferred_username` when the Relying Party did not request `profile`; MUST set `iss` to its own Issuer Identifier and `home_iss` to the Home Issuer's; MUST NOT add Claims the Home Issuer did not assert; and MUST set `exp` no later than the upstream token's `exp`.

### 8.4 Transaction Hand-off

The Relay's Transaction Resource MUST report `status` `awaiting_agent` with `next.action` `identify` when the handle is unknown: the Agent Client posts `{"handle": "scout@example.com"}` to `next.url` without credentials; the Relay accepts one such request per transaction, validates it per Section 2.1, performs discovery, and MUST rate-limit `identify` per source. Once the handle is known the Relay MUST report `next.action` `follow` with `next.url` equal to the `url` of the Home Issuer's Transaction Resource and `retry_after` set. The Agent Client MUST verify that `next.url` is under the `transaction_endpoint` of the Home Issuer that its own discovery designates, asserts there with `deliver_to_session` `true`, and then polls the Relay's Transaction Resource.

The Relay polls the Home Issuer's Transaction Resource with its upstream `session_token`; when the upstream `status` is `ready` it follows the continue step with `Accept: application/json`, exchanges the code (Section 5.6), validates the token (Section 8.2), applies Section 7.6, and evaluates its own Consent Record for (Agent, Relying Party `client_id`, scopes), which the Home Issuer's Consent Record for the Relay never replaces. It then sets its own `status` to `awaiting_consent` or `ready` and, on the next `GET` by the holder of its session binding, returns a `transaction_token` for its transaction; that token authorises the Relay's `review` and `continue` steps. The Relay's disclosure MUST state that the Owner's identity, when requested, is forwarded to the named Relying Party, and the Relay MUST NOT forward Owner Claims unless its own Consent Record covers the Owner scopes. An upstream `denied` or `expired` sets the same `status` and `reason` on the Relay's transaction.

### 8.5 Relay Policy

A Relay MUST publish which Home Issuers it accepts (`home_issuers`), either as a list or, with `["*"]`, as a verification rule documented at `op_policy_uri`, and MAY apply per-Home-Issuer caps and rate limits. A Relay MAY retain the upstream Access Token for no longer than the lifetime of the Access Token it issued, solely to evaluate live state, and MUST then discard it; it MUST NOT retain upstream ID Tokens after validation. The Relay's UserInfo Endpoint MUST call the Home Issuer's UserInfo Endpoint on every request and MUST answer `401` `invalid_token` when the upstream answers `401` or the upstream Access Token has expired.

## 9. Relying Party Requirements

A Relying Party MUST:

1. Key Account records on the pair (`iss`, `sub`), never on `email` or `preferred_username`. The same handle presented by two Issuers, or by a Relay and its Home Issuer, is two Agents until the Relying Party links them by its own policy.
2. Validate every response per Section 5.7 and store nothing from a token that failed.
3. Branch on `actor_type` equal to `agent` for policy that applies to agents, such as quotas, feature gates and terms.
4. When `profile` was granted, enforce per-owner limits on (`iss`, `owner_sub`); when `owner_email` was granted, use it for contact and accountability, not as a key.
5. Keep the Access Token for at most its lifetime, use it only at the UserInfo Endpoint, verify that the returned `sub` equals the ID Token's and discard the response otherwise [OpenID.Core Section 5.3.2], and issue the application's own session with a lifetime chosen by its own policy.
6. Before actions with lasting effect, re-check the Agent at the UserInfo Endpoint within the Access Token lifetime or require a new sign-in; treat `401` `invalid_token` as revocation.
7. Present `access_denied` and `signup_limit_reached` as distinct outcomes, and never render `error_description` without escaping.
8. Not log ID Tokens or Access Tokens, and store Owner data separately from Agent data.
9. Perform discovery only for handles presented to it, and cache results per Section 2.2.
10. To accept Agents from several Issuers, either perform discovery per handle against an allow-list or per-Issuer limits, or configure one Relay (Section 8).

## 10. Security Considerations

This specification inherits the security considerations of OAuth 2.0 [RFC6749] Section 10, Bearer Token Usage [RFC6750] Section 5, the OAuth 2.0 Security Best Current Practice [RFC9700] and Threat Model [RFC6819], OpenID Connect Core [OpenID.Core] Section 16, JWT Best Current Practices [RFC8725], WebFinger [RFC7033] Section 9 and [CIMD]. The considerations below are specific to this profile and explain requirements stated in Sections 2 to 9.

### 10.1 Transaction Fixation

An attacker can start a transaction in its own browser and induce an Agent to assert on it, for example by sending the wait page's identifier with a plausible story; the disclosure names the genuine Relying Party, so the Agent sees nothing wrong. If the attacker's bound session could then follow the continue step, the attacker would hold a Relying Party session as the Agent (compare Section 5.4 of [RFC8628]). Section 6.5 therefore releases the result to the Session Holder only when the assertion carries `deliver_to_session`, which an Agent Client sets only for a transaction it loaded itself or that a Relay it is signing in through asked it to follow, and Section 6.1 lets the Issuer describe the requester so the Agent, or its Owner, can inspect it. The transaction identifier and the wait page are not secrets; the assertion signature is the only authority to advance a transaction, and the `transaction_token` and `session_token` are bearer capabilities derived from it.

### 10.2 Assertion Replay and Cross-Issuer Use

An assertion is bound to one Issuer by `aud`, to one transaction by `txn`, to one challenge by `nonce`, and to a T_ASSERT window by `exp`; the Issuer consumes the challenge and refuses a second assertion. A captured assertion is therefore useless elsewhere, including at a Relay, whose own `aud` differs from the Home Issuer's.

### 10.3 Key Compromise and Revocation Latency

Revocation stops new sign-ins, voids unredeemed codes and invalidates outstanding Access Tokens at once, but it cannot reach sessions a Relying Party has already issued. The T_TOKEN lifetime bounds the window in which a Relying Party acting on the token alone remains unaware; Section 9 requires a UserInfo re-check before lasting actions. Section 7.2 refuses re-enrollment of a revoked public key so that revocation cannot be undone by re-enrollment.

### 10.4 Issuer Impersonation and Handle Binding

A rogue Issuer can mint a syntactically valid token for any handle, and a configured Issuer could claim a `home_iss` it never consulted. Section 2.5 requires the Relying Party to confirm that the handle's domain designates the token's `iss`, to accept `home_iss` only from Issuers it configured as Relays, and to check `home_iss` against the Relay's published list. Discovery runs over HTTPS with certificate validation per [RFC9525] and no fallback to HTTP; the DNS fallback is accepted only with DNSSEC validation, since an unsigned record is attacker-controllable and the `handle_domains` confirmation protects only the Issuer.

### 10.5 Mix-up and Redirect Attacks

The `iss` parameter on the redirect [RFC9207], the per-`state` record of the Issuer the request was sent to, and the exact-match rule for `redirect_uri` defend against mix-up and open-redirect attacks; the Issuer never redirects to an unvalidated URI. PKCE is required of Registered Clients as well because a client secret alone does not prevent code injection. Third-party-initiated login (Section 5.8) is accepted only for configured Issuers so that it cannot be used to make a Relying Party fetch attacker URLs.

### 10.6 Open Client Impersonation and Server-Side Request Forgery

An Open Client is trusted only as far as its document URL. Section 4.2 requires the Issuer to fetch the document under the protections of Section 2.2 (no special-use addresses, size and time limits, no redirects, no credentials), and Section 6.1 shows the document's host as `client.redirect_host` so the Agent sees who is asking. Owner personal data is withheld from Open Clients because their operator is unverified. The same fetch protections apply to WebFinger, metadata and JWK Set fetches, whose targets are chosen by whoever supplies a handle.

### 10.7 Limits of Owner Attribution

A token proves which Agent signed in and, through the Owner Claims, which verified address stands behind it. It is attribution and a point of revocation, not an endorsement of the Agent's behaviour or of the Owner's intent. `owner_verified_via` `email` proves control of an address at the time of verification and nothing more; Owner approval (Section 6.6) is required within an authenticated Owner session precisely because Agents commonly read their Owner's mail.

### 10.8 Sign-up Abuse and Enumeration

Free identities attract automated sign-up farms. Per-owner caps and Owner verification before the first Account are the structural defences; Issuers SHOULD additionally limit transactions per client and per source address and throttle repeated invalid assertions for one transaction, answering `429` with `Retry-After` (Section 6.7). WebFinger makes handles enumerable by design; Issuers SHOULD not expose handle lists beyond the per-handle lookup.

### 10.9 Algorithm and Key Confusion

Sections 3.2, 5.7, 6.3 and 7.2 pin the accepted algorithms, require `alg` to match the key's type, reject `none`, and take keys only from the configured JWK Set or the enrolled key record, never from `jwk`, `jku`, `x5u` or `x5c` headers [RFC8725]. The distinct `typ` values keep an assertion from passing as an ID Token and an enrollment proof from passing as an assertion.

### 10.10 Transport, Caching and Clickjacking

Every endpoint requires TLS per [BCP195], every response carrying codes, tokens, challenges or transaction state is marked `no-store` (Section 5), and the Issuer's HTML pages carry a Content-Security-Policy with `frame-ancestors 'none'` (Section 5.3) because the wait, review and Owner approval pages are exactly the pages a clickjacking attack would target [RFC9700 Section 4.16].

## 11. Privacy Considerations

### 11.1 Owner Personal Data

The Owner's name and address reach only Registered Clients, only for the `owner_profile` and `owner_email` scopes, and only after the disclosure of Section 6.1 listed them. The Owner's authorisation is expressed either as the `share_owner` permission on the key, which only an Owner Credential can grant, or as an approval under Section 6.6. Relying Parties keep Owner data apart from Agent data (Section 9).

### 11.2 Correlation across Relying Parties

`sub` and `owner_sub` are `public` subject identifiers: they let Relying Parties recognise the same Agent and the same Owner, which the per-owner cap requires. The cost is that colluding Relying Parties can correlate an Owner's Agents. An Issuer MAY offer `pairwise` subjects as an alternative advertised in `subject_types_supported`; a Relying Party then cannot enforce caps across clients. A Relay's derived `sub` cannot be reversed to the upstream value and differs per Home Issuer.

### 11.3 Discovery Leakage

The handle's domain names the Owner's operator, and each WebFinger lookup tells that domain which party is asking. Section 9 limits lookups to handles actually presented and requires caching.

### 11.4 Relays

A Relay sees every Claim of every Agent it relays. Section 8.5 requires it to publish `op_policy_uri`, to retain upstream Access Tokens only for live-state checks within its own token lifetime, and to retain no upstream ID Tokens; it SHOULD retain transaction records no longer than needed for abuse handling.

### 11.5 Retention

Consent Records expire after at most T_CONSENT of non-use. Sign-in history (Section 7.4) SHOULD be visible to the Owner. Transaction identifiers MAY be logged; assertions, tokens, challenges and continue URLs MUST NOT be.

## 12. Conformance

An **Issuer** MUST behave as described by Sections 2.4, 2.5, 3 to 7, 10 and 11. A **Relying Party** MUST behave as described by Sections 2.2 to 2.5, 5.1, 5.6 to 5.8 and 9. An **Agent Client** MUST behave as described by Sections 2.1 to 2.3, 5.3, 5.8, 6.1 to 6.6, 7.1 and 7.2. A **Relay** MUST behave as an Issuer and as described by Section 8. Each class MUST remain secure against members of other classes that do not conform. The repository's conformance checklist enumerates the testable statements of each class, and version 1.0 requires two independent implementations to pass it (GOVERNANCE.md).

## 13. IANA Considerations

Registrations are provisional until this document has a standards-body home.

### 13.1 JSON Web Token Claims

This specification requests registration of `actor_type`, `owner_sub`, `owner_name`, `owner_email`, `owner_email_verified`, `owner_verified_via` and `home_iss` in the IANA "JSON Web Token Claims" registry [IANA.JWT.Claims], with this document as the specification document (Section 3.1). The names are not collision-resistant because wire compatibility with a deployed issuer requires them. `accept_disclosure` and `deliver_to_session` are used only in JWTs of type `agent-login+jwt` and are not registered.

### 13.2 OAuth Authorization Server Metadata

`transaction_endpoint`, `agents_endpoint`, `handle_domains`, `home_issuers`, `agent_key_algs_supported` and `agent_login_versions_supported` in the "OAuth Authorization Server Metadata" registry [IANA.OAuth.Parameters] (Section 2.4).

### 13.3 OAuth Dynamic Client Registration Metadata

`max_signups_per_owner` and `require_review` in the "OAuth Dynamic Client Registration Metadata" registry [IANA.OAuth.Parameters] (Section 4.4).

### 13.4 OAuth Extensions Error

`signup_limit_reached`, usage location authorization endpoint, in the "OAuth Extensions Error" registry [IANA.OAuth.Parameters] (Section 5.5). Transaction error codes (Section 6.7) are local to the transaction endpoint and are not registered.

### 13.5 Media Types and Link Relation

`application/agent-login+jwt` and `application/agent-login-enrollment+jwt` per [RFC6838] for the `typ` values of Sections 6.3 and 7.2, and the link relation type `agent-login-transaction` per [RFC8288] (Section 5.3).

## 14. References

### 14.1 Normative References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [RFC6749] Hardt, D., Ed., "The OAuth 2.0 Authorization Framework", RFC 6749, October 2012.
- [RFC6750] Jones, M. and D. Hardt, "The OAuth 2.0 Authorization Framework: Bearer Token Usage", RFC 6750, October 2012.
- [RFC7636] Sakimura, N., Bradley, J. and N. Agarwal, "Proof Key for Code Exchange by OAuth Public Clients", RFC 7636, September 2015.
- [RFC9207] Meyer zu Selhausen, K. and D. Fett, "OAuth 2.0 Authorization Server Issuer Identification", RFC 9207, March 2022.
- [OpenID.Core] Sakimura, N., Bradley, J., Jones, M., de Medeiros, B. and C. Mortimore, "OpenID Connect Core 1.0 incorporating errata set 2", December 2023.
- [OpenID.Discovery] Sakimura, N., Bradley, J., Jones, M. and E. Jay, "OpenID Connect Discovery 1.0 incorporating errata set 2", December 2023.
- [OpenID.Registration] Sakimura, N., Bradley, J. and M. Jones, "OpenID Connect Dynamic Client Registration 1.0 incorporating errata set 2", December 2023.
- [RFC8414] Jones, M., Sakimura, N. and J. Bradley, "OAuth 2.0 Authorization Server Metadata", RFC 8414, June 2018.
- [RFC7591] Richer, J., Ed., Jones, M., Bradley, J., Machulak, M. and P. Hunt, "OAuth 2.0 Dynamic Client Registration Protocol", RFC 7591, July 2015.
- [CIMD] Parecki, A. and E. Smith, "OAuth Client ID Metadata Document", draft-ietf-oauth-client-id-metadata-document-02, July 2026, Work in Progress.
- [RFC7033] Jones, P., Salgueiro, G., Jones, M. and J. Smarr, "WebFinger", RFC 7033, September 2013.
- [RFC7565] Saint-Andre, P., "The 'acct' URI Scheme", RFC 7565, May 2015.
- [RFC5322] Resnick, P., Ed., "Internet Message Format", RFC 5322, October 2008.
- [RFC1035] Mockapetris, P., "Domain Names - Implementation and Specification", STD 13, RFC 1035, November 1987.
- [RFC6890] Cotton, M., Vegoda, L., Bonica, R., Ed. and B. Haberman, "Special-Purpose IP Address Registries", BCP 153, RFC 6890, April 2013.
- [RFC7515] Jones, M., Bradley, J. and N. Sakimura, "JSON Web Signature (JWS)", RFC 7515, May 2015.
- [RFC7517] Jones, M., "JSON Web Key (JWK)", RFC 7517, May 2015.
- [RFC7518] Jones, M., "JSON Web Algorithms (JWA)", RFC 7518, May 2015.
- [RFC7519] Jones, M., Bradley, J. and N. Sakimura, "JSON Web Token (JWT)", RFC 7519, May 2015.
- [RFC7523] Jones, M., Campbell, B. and C. Mortimore, "JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants", RFC 7523, May 2015.
- [RFC7617] Reschke, J., "The 'Basic' HTTP Authentication Scheme", RFC 7617, September 2015.
- [RFC7638] Jones, M. and N. Sakimura, "JSON Web Key (JWK) Thumbprint", RFC 7638, September 2015.
- [RFC8037] Liusvaara, I., "CFRG Elliptic Curve Diffie-Hellman (ECDH) and Signatures in JSON Object Signing and Encryption (JOSE)", RFC 8037, January 2017.
- [RFC8417] Hunt, P., Ed., Jones, M., Denniss, W. and M. Ansari, "Security Event Token (SET)", RFC 8417, July 2018.
- [RFC8693] Jones, M., Nadalin, A., Campbell, B., Ed., Bradley, J. and C. Mortimore, "OAuth 2.0 Token Exchange", RFC 8693, January 2020.
- [RFC8252] Denniss, W. and J. Bradley, "OAuth 2.0 for Native Apps", BCP 212, RFC 8252, October 2017.
- [RFC8259] Bray, T., Ed., "The JavaScript Object Notation (JSON) Data Interchange Format", STD 90, RFC 8259, December 2017.
- [RFC9110] Fielding, R., Ed., Nottingham, M., Ed. and J. Reschke, Ed., "HTTP Semantics", STD 97, RFC 9110, June 2022.
- [RFC8288] Nottingham, M., "Web Linking", RFC 8288, October 2017.
- [RFC3986] Berners-Lee, T., Fielding, R. and L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax", STD 66, RFC 3986, January 2005.
- [RFC5234] Crocker, D., Ed. and P. Overell, "Augmented BNF for Syntax Specifications: ABNF", STD 68, RFC 5234, January 2008.
- [BCP195] Sheffer, Y., Saint-Andre, P. and T. Fossati, "Recommendations for Secure Use of Transport Layer Security (TLS) and Datagram Transport Layer Security (DTLS)", BCP 195, RFC 9325, November 2022.
- [RFC9525] Saint-Andre, P. and R. Salz, "Service Identity in TLS", RFC 9525, November 2023.
- [RFC8725] Sheffer, Y., Hardt, D. and M. Jones, "JSON Web Token Best Current Practices", BCP 225, RFC 8725, February 2020.
- [RFC9700] Lodderstedt, T., Bradley, J., Labunets, A. and D. Fett, "Best Current Practice for OAuth 2.0 Security", BCP 240, RFC 9700, January 2025.
- [RFC6838] Freed, N., Klensin, J. and T. Hansen, "Media Type Specifications and Registration Procedures", BCP 13, RFC 6838, January 2013.
- [IANA.JWT.Claims] IANA, "JSON Web Token Claims".
- [IANA.OAuth.Parameters] IANA, "OAuth Parameters".

### 14.2 Informative References

- [RFC6819] Lodderstedt, T., Ed., McGloin, M. and P. Hunt, "OAuth 2.0 Threat Model and Security Considerations", RFC 6819, January 2013.
- [RFC8628] Denniss, W., Bradley, J., Jones, M. and H. Tschofenig, "OAuth 2.0 Device Authorization Grant", RFC 8628, August 2019.
- [RFC6530] Klensin, J. and Y. Ko, "Overview and Framework for Internationalized Email", RFC 6530, February 2012.
- [RFC9728] Jones, M., Hunt, P. and A. Parecki, "OAuth 2.0 Protected Resource Metadata", RFC 9728, April 2025.
- [auth.md] WorkOS, "auth.md: agent registration", open specification, May 2026.
- [OpenID.BackChannel] Jones, M. and J. Bradley, "OpenID Connect Back-Channel Logout 1.0 incorporating errata set 1", September 2022.
- [OpenID.SSF] OpenID Foundation, "Shared Signals Framework 1.0" and "Continuous Access Evaluation Profile 1.0".
- [IndieAuth] Parecki, A., Ed., "IndieAuth", W3C Note and living standard.
- [WebAuthn] Hodges, J., Jones, J.C., Jones, M.B., Kumar, A. and E. Lundberg, "Web Authentication: An API for accessing Public Key Credentials, Level 2", W3C Recommendation, April 2021.
- [AgentID.Docs] AgentMail, Inc., "AgentID documentation", https://www.agentid.com/docs and https://docs.agentmail.to/agentid-sign-in, retrieved 9-10 October 2026.
- [AgentID.Interop] Agent Login editors, "AgentID interoperability notes", interop-agentid.md in this repository, October 2026.

## Appendix A. Complete Sign-in over HTTP (Informative)

This appendix is not normative. It follows one sign-in of `scout@example.com` at the Open Client `https://client.example.org`, performed entirely by an Agent Client that is also the Session Holder. Long values are wrapped for display only.

### A.1 Discovery

```
GET /.well-known/webfinger?resource=acct%3Ascout%40example.com
    &rel=http%3A%2F%2Fopenid.net%2Fspecs%2Fconnect%2F1.0%2Fissuer HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: application/jrd+json

{"subject": "acct:scout@example.com",
 "links": [{"rel": "http://openid.net/specs/connect/1.0/issuer",
            "href": "https://issuer.example"}]}
```

Issuer metadata, excerpt: `"transaction_endpoint": "https://issuer.example/transactions"`, `"agents_endpoint": "https://issuer.example/agents"`, `"handle_domains": ["example.com"]`, `"agent_key_algs_supported": ["ES256"]`, `"agent_login_versions_supported": ["1.0"]`.

### A.2 Keys

The Agent Key used below, with identifier `gDfgvWhf8W3eJn4C6hIXLUIMp7wqzKT5UjXzAyQsbco`:

```json
{"kty": "EC", "crv": "P-256",
 "x": "5MZ_9cVWePNPJPkHf0pDJpEXx_2vpL3xWDdRWqhh5EA",
 "y": "B5-iufQSRvDpSppXqU2-b-CxUIqhKMITz6srjiZ2mVY"}
```

The Issuer's signing key, from its JWK Set:

```json
{"kty": "EC", "crv": "P-256", "kid": "otpInnKsHq1yB3UIa595eNePJTQqcwCHNSz79q69Mqw",
 "use": "sig", "alg": "ES256",
 "x": "sq46rt8ScWblXXcu_oRP27_alMZ_PYS2NHE0E3BEIRw",
 "y": "c4Lfaf3V_dtgRWIOPzS-i6RPbO7xXaeb1U7aL18j0DE"}
```

### A.3 Authentication Request and Transaction

The Agent Client performs the request of Section 5.1 with `Accept: application/json` and receives the transaction with its `session_token`:

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{"transaction_id": "3oQ7vK1dR8bN2mL9xA5yZw",
 "iss": "https://issuer.example",
 "url": "https://issuer.example/transactions/3oQ7vK1dR8bN2mL9xA5yZw",
 "status": "awaiting_agent",
 "next": {"action": "assert", "method": "POST",
          "url": "https://issuer.example/transactions/3oQ7vK1dR8bN2mL9xA5yZw/assertion"},
 "expires_at": 1791600300,
 "client": {"client_id": "https://client.example.org/client-metadata.json",
            "client_type": "open", "client_name": "Example Client",
            "redirect_host": "client.example.org"},
 "requested_scopes": ["openid", "email", "profile"],
 "disclosure": [
   {"scope": "openid", "title": "Agent identity",
    "description": "A stable identifier for this agent."},
   {"scope": "email", "title": "Handle",
    "description": "The agent's handle, scout@example.com."},
   {"scope": "profile", "title": "Name and owner identifier",
    "description": "The agent's name and an opaque identifier for its owner."}],
 "requester": {"user_agent": "agentlogin-cli/0.1", "network": "203.0.113.0/24"},
 "challenge": "Hk2pXr9cT4vB7nL1qW8sYg",
 "session_token": "st_8kP3nV6qL1xZ4rT9wB2mYc"}
```

### A.4 Assertion

Decoded protected header and payload of the assertion, which verifies against the Agent Key above:

```json
{"alg": "ES256", "typ": "agent-login+jwt",
 "kid": "gDfgvWhf8W3eJn4C6hIXLUIMp7wqzKT5UjXzAyQsbco"}

{"iss": "scout@example.com", "sub": "scout@example.com",
 "aud": "https://issuer.example",
 "txn": "3oQ7vK1dR8bN2mL9xA5yZw", "nonce": "Hk2pXr9cT4vB7nL1qW8sYg",
 "iat": 1791600000, "exp": 1791600300,
 "jti": "c4Lw9eRt2YqK7pZ1nM8vXb", "accept_disclosure": true}
```

The Agent Client is its own Session Holder, so `deliver_to_session` is absent and the result is released to its `transaction_token`.

```
POST /transactions/3oQ7vK1dR8bN2mL9xA5yZw/assertion HTTP/1.1
Host: issuer.example
Content-Type: application/json

{"assertion": "eyJhbGciOiJFUzI1NiIsInR5cCI6ImFnZW50LWxvZ2luK2p3dCIsImtpZCI6ImdEZmd2V2hmOFcz
  ZUpuNEM2aElYTFVJTXA3d3F6S1Q1VWpYekF5UXNiY28ifQ.eyJpc3MiOiJzY291dEBleGFtcGxlL
  mNvbSIsInN1YiI6InNjb3V0QGV4YW1wbGUuY29tIiwiYXVkIjoiaHR0cHM6Ly9pc3N1ZXIuZXhhb
  XBsZSIsInR4biI6IjNvUTd2SzFkUjhiTjJtTDl4QTV5WnciLCJub25jZSI6IkhrMnBYcjljVDR2Q
  jduTDFxVzhzWWciLCJpYXQiOjE3OTE2MDAwMDAsImV4cCI6MTc5MTYwMDMwMCwianRpIjoiYzRMd
  zllUnQyWXFLN3BaMW5NOHZYYiIsImFjY2VwdF9kaXNjbG9zdXJlIjp0cnVlfQ.C7A2xlQWZgH1UU
  TbvEBvwY3vMXx1HC9dL6oulOLPlKL7qrtQfFwRePSgSb7WawFNkcAYgCpwWpxLM7e1uTXuIQ"}

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{"transaction_id": "3oQ7vK1dR8bN2mL9xA5yZw",
 "iss": "https://issuer.example",
 "url": "https://issuer.example/transactions/3oQ7vK1dR8bN2mL9xA5yZw",
 "status": "ready",
 "next": {"action": "continue", "method": "GET",
          "url": "https://issuer.example/transactions/3oQ7vK1dR8bN2mL9xA5yZw/continue/Vq8sLm2nRt5yWk7bPz4cXe"},
 "transaction_token": "tt_4xQ9mN2bK7vL1pR8sT3yWz",
 "expires_at": 1791600300, "...": "..."}
```

Had no Consent Record covered the request and had `accept_disclosure` been absent, the response would have carried `"status": "awaiting_consent"`, `"consent_reason": "first_visit"` and `"next": {"action": "review", "method": "POST", "url": ".../decision"}`.

### A.5 Completion and Token Exchange

```
GET /transactions/3oQ7vK1dR8bN2mL9xA5yZw/continue/Vq8sLm2nRt5yWk7bPz4cXe HTTP/1.1
Host: issuer.example
Accept: application/json
Authorization: Bearer tt_4xQ9mN2bK7vL1pR8sT3yWz

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{"redirect": "https://client.example.org/cb?code=SplxlOBeZQQYbYS6WxSbIA
   &state=Yq3nXr8vL2kT5wB9mC1dPz&iss=https%3A%2F%2Fissuer.example"}
```

The Agent Client fetches the redirect with the cookie jar it keeps for `client.example.org`; the Relying Party exchanges the code:

```
POST /token HTTP/1.1
Host: issuer.example
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA
&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb
&client_id=https%3A%2F%2Fclient.example.org%2Fclient-metadata.json
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{"access_token": "...[omitted for brevity]...", "token_type": "Bearer",
 "expires_in": 600, "scope": "openid email profile",
 "id_token": "...[omitted for brevity]..."}
```

The ID Token of Section 3.4, signed by the Issuer key of A.2, is the following JWS (issued to the Registered Client of Section 3.4; its Claims differ from this Open Client sign-in in `aud`, `scope` and the Owner Claims):

```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im90cElubktzSHExeUIzVUlhNTk1ZU5lUEpU
UXFjd0NITlN6NzlxNjlNcXcifQ.eyJpc3MiOiJodHRwczovL2lzc3Vlci5leGFtcGxlIiwic3ViIjoiY
jFZa205d1EydE4wY0o2dlI4ZEx4QTVoWjNwUzd1RTRnRjFpVDJvVzlxTSIsImF1ZCI6InM2QmhkUmtxd
DMiLCJleHAiOjE3OTE2MDA2NjAsImlhdCI6MTc5MTYwMDA2MCwianRpIjoiOWYxYzJhNDQtM2U3Ny00Y
zE5LTlhMmUtNmIwZDVmOGUxYzMzIiwibm9uY2UiOiJWYjdrUTJtUjl0TDR4TjFjVzhzSnlBIiwiYWN0b
3JfdHlwZSI6ImFnZW50Iiwic2NvcGUiOiJvcGVuaWQgZW1haWwgcHJvZmlsZSBvd25lcl9lbWFpbCIsI
mVtYWlsIjoic2NvdXRAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlNjb
3V0IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic2NvdXQiLCJvd25lcl9zdWIiOiJvVjNuSjhkSzFxVDZ4Q
jJtWjljTDRySDd5UDBzQTV3RTh1RzFmSTJrTjNNIiwib3duZXJfZW1haWwiOiJqYW5lQGV4YW1wbGUuY
29tIiwib3duZXJfZW1haWxfdmVyaWZpZWQiOnRydWUsIm93bmVyX3ZlcmlmaWVkX3ZpYSI6ImVtYWlsI
n0.ztDNVkvlZcjT5efputCBxwC5gCLxWFtsqe9eU7sIFtW5fSia2ybZoB7ItVim1kIYZDhwQeJlNrTks
3Ep2g93mw
```

## Appendix B. Mapping to AgentID (Informative)

This appendix is not normative. AgentID is a sign-in service for agents operated by AgentMail, Inc. at `https://auth.agentid.com`, public since 6 October 2026 [AgentID.Docs]. Rows marked (observed) were verified against the live service on 9 and 10 October 2026 for one unregistered client requesting `openid email profile` [AgentID.Interop]; rows marked (docs) are taken from AgentMail's documentation and were not exercised. Registered clients and Owner Claims were not tested. Everything is subject to change.

| Aspect | AgentID | This document |
| --- | --- | --- |
| Flow | Authorization Code with PKCE `S256` required for unregistered clients, ES256 ID Tokens with `kid`, `iss` on the redirect (observed) | Same |
| Lifetimes | Tokens 600 s, single-use code (observed); code lifetime 60 s, no Refresh Tokens (docs, discovery) | Same |
| Claims | `actor_type`, `sub`, `email`, `email_verified`, `name`, `preferred_username`, `owner_sub` (observed); `owner_name`, `owner_email`, `owner_email_verified` for registered clients (docs) | Same names and semantics, plus `owner_verified_via` and `home_iss`; `scope` always present (absent from the tested client's tokens) |
| Scopes and tiers | `openid email profile owner_profile owner_email`; Owner Claims for registered clients only (docs) | Same |
| Identity | An AgentMail inbox; fixed issuer; no discovery | A handle on any domain; WebFinger and DNS discovery; any Issuer |
| Unregistered clients | Any HTTPS URL as `client_id` (a path is accepted), same-host redirect rule, no metadata document, URL need not resolve (observed) | Client ID Metadata Document |
| Agent side | Page endpoints `/v0/authorize/enrollment`, `/enrollment/proof`, `/authenticate/browser/challenge`, `/authenticate/browser` (with a custom `x-agentid-navigation` header), `/disclosure`, `/decision` (form post with CSRF token), `/continue`; responses name a `next_state` but no next URL (observed); first sign-in approved with a bearer API credential (documented) while the page or client generates the key; a browserless sign-in through these endpoints was completed (observed); a documented assertion-approval endpoint for externally held keys was not live (observed) | One Transaction Resource with `status` and `next`, assertion by the Agent's own key, no cookies or CSRF for Agent Clients |
| Consent memory | 180 days (docs); every repeat sign-in for the tested client required the review, reported as `first_visit` (observed) | Consent Records skip the review unless `prompt=consent`, `require_review` or policy applies |
| Caps and disable | Per-owner caps enforced before an account exists; disabled account ends in `access_denied` (observed); outcome named `signup_limit_reached` in console and page script, `limit_exceeded` in the API; redirect error to the Relying Party not observed | `signup_limit_reached` redirect error; `access_denied` for disabled Accounts |
| Revocation | Deleting the key invalidated an unexpired access token within seconds, UserInfo answered `401` (observed); no consent revocation, no per-Agent bulk revoke, no `private_key_jwt` (docs, discovery) | Same invalidation, plus bulk revoke, consent revocation and `private_key_jwt` |
| Registration | Human-approved console; `/v0/register` answers `401` (observed) | RFC 7591 or console |
| Errors | Proprietary body `{name, code, message, fix, docs}` (observed) | OAuth error object |

State mapping, from AgentID's wait-page script (`needs_enrollment`, `pending`, `activated`, `authenticated`, `reviewing_disclosure` and `ready` were also observed live):

| AgentID value | This document |
| --- | --- |
| `needs_enrollment`, `pending`, `activated`, `authenticated` | `awaiting_agent` and the assertion of Section 6.3 |
| `reviewing_disclosure`, `consent_required` | `awaiting_consent` |
| `ready` | `ready` |
| `restart_required` | `expired` |
| `signup_limit_reached` | `denied`, `reason` `signup_limit_reached` |
| `denied` | `denied` |
| `consent_reason` `first_visit`, `material_change`, `expired`, `prompt_consent` | same values |

One application accepts both by configuring two OpenID Connect connections sharing one account model keyed on (`iss`, `sub`), branching on `actor_type` and keeping `owner_sub` per Issuer; the handle-to-Issuer binding of Section 2.5 applies to the Agent Login connection only. An Agent Client MAY implement an adapter for AgentID: read the 22-character `auth_token` from its wait page, approve with the documented bearer call `POST https://api.agentmail.to/v0/inboxes/{inbox}/authorize`, and complete through the page endpoints, whose support and stability are unestablished.

## Appendix C. Notices

The text of this specification is licensed under the Creative Commons Attribution 4.0 International licence; code samples are additionally licensed under the Apache License, Version 2.0.
