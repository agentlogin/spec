# Agent Login Core 1.0 - draft 0.2 (proposed)

| | |
| --- | --- |
| Status | Proposed Working Draft; not approved for publication |
| Date | 13 October 2026 |
| Editors | S. Arregger (SentFromAI); second editor sought, see GOVERNANCE.md |
| Repository | https://github.com/agentlogin/spec |

## Abstract

Agent Login is a profile of OpenID Connect for signing software agents in to web applications. An Agent is identified by a handle of the form `local@domain`; the domain publishes which Issuer vouches for its Agents. The ID Token names the Agent, marks it as an agent and, when the application is registered and asks, names the human Owner accountable for it. The Agent proves possession of a key it holds through a Sign-in Transaction that a plain HTTP client completes without a browser.

## Status of This Document

This is proposed working draft 0.2, prepared for implementer review under [GOVERNANCE.md](GOVERNANCE.md). Behaviour MAY change between drafts. Version 1.0 requires two independent implementations that interoperate end to end and pass the applicable conformance checklist. Feedback is collected in the repository issue tracker. The editors intend to submit this document as an Internet-Draft. This proposal makes no claim of completed independent review or implementation conformance.

## Copyright and Licence

Text: CC BY 4.0. Code samples: Apache-2.0 in addition (Appendix C).

## Table of Contents

1. Introduction
2. Agent Handles and Issuer Discovery
3. The ID Token and UserInfo Response
4. Scopes and Client Tiers
5. Authentication
6. The Sign-in Transaction
7. Agents, Keys, Owners and Caps
8. Relay Profile
9. Relying Party Requirements
10. Security Considerations
11. Privacy Considerations
12. Conformance
13. IANA Considerations
14. References
Appendix A. Complete Sign-in over HTTP (Informative)
Appendix B. Mapping to AgentID (Informative)
Appendix C. Notices

## 1. Introduction

Agents today sign up with a human's email address, read the human's one-time codes and act under the human's account; the application cannot tell an agent from a person, one person's fleet from many customers, or whom to hold accountable.

This specification gives the Agent an identity of its own: a handle whose domain designates an Issuer (Section 2); an ID Token with `actor_type` `agent`, a stable `sub` and, for registered applications that request it, the Owner's verified identity (Sections 3, 4); and authentication by signing a challenge with a key the Agent holds (Section 6).

### 1.1 Requirements Notation and Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as shown here.

Values to be taken literally are shown in `fixed-width`. HTTP semantics and status codes are per [RFC9110]. JSON is per [RFC8259]; request and response bodies defined by this document are JSON objects with `Content-Type: application/json` unless stated otherwise. JWTs use the JWS Compact Serialization only. String comparison is by simple string comparison (Section 6.2 of [RFC3986]), and parameter names and values are case-sensitive, unless stated otherwise. ABNF is per [RFC5234]. An algorithm matches a key when `alg` is `ES256` and the key has `kty` `EC` and `crv` `P-256`, or `alg` is `Ed25519` and the key has `kty` `OKP` and `crv` `Ed25519` [RFC9864]. No other signature algorithm is permitted by this draft. The deprecated `EdDSA` identifier is not an alias for `Ed25519`; see migration-0.2.md. Examples are non-normative; long values are wrapped for display only.

Example values: Agent handle `scout@example.com`, Owner `jane@example.com`, Issuer `https://issuer.example`, Relying Party `https://client.example.org` with redirect URI `https://client.example.org/cb`, Client ID Metadata Document `https://client.example.org/client-metadata.json` and, when registered, `client_id` `s6BhdRkqt3`. Other values are those of Appendix A, whose signatures verify against the keys printed there.

### 1.2 Terminology

This specification uses the terms "Authorization Code", "Authorization Endpoint", "Authorization Server", "Client", "Client Identifier", "Redirection URI", "Token Endpoint" and "Access Token" defined by OAuth 2.0 [RFC6749]; "ID Token", "Issuer Identifier", "OpenID Provider", "Relying Party", "UserInfo Endpoint" and "Claim" defined by OpenID Connect Core 1.0 [OpenID.Core]; "JWT", "JWS", "JWK" and "JWK Set" defined by [RFC7519], [RFC7515] and [RFC7517]; "Client ID Metadata Document" defined by [CIMD]; and "JRD" and "link relation" defined by WebFinger [RFC7033].

This specification also defines the following terms:

- **Agent**: a software process that signs in to Relying Parties under its own identity, acting for an Owner.
- **Agent Handle** (handle): the identifier of an Agent, `local@domain` (Section 2.1).
- **Owner**: the human, or the organisation represented by its administrators, accountable for an Agent. Every Agent has exactly one Owner.
- **Issuer**: an OpenID Provider conforming to this specification that vouches for Agents whose handles are in domains delegated to it.
- **Home Issuer**: the Issuer that a handle's domain designates (Section 2).
- **Relay**: an Issuer that authenticates an Agent at its Home Issuer and issues its own ID Token (Section 8).
- **Agent Key**: an asymmetric key pair whose private half the Agent holds and whose public half is enrolled at the Issuer (Section 7.1).
- **Agent Client**: the HTTP software that completes a Sign-in Transaction on behalf of an Agent: a browser, a command-line tool or a library.
- **Session Holder**: the HTTP requester, a browser or an Agent Client, that started the Authentication Request and will hold the application session; the Authorization Code is delivered to it (Sections 5.3, 6.5). An Agent Client is often also the Session Holder.
- **Sign-in Transaction** (transaction): the Issuer-side record of one Authentication Request from creation until a code or an error is delivered (Section 6).
- **Transaction Resource**: the JSON representation of a transaction (Section 6.1).
- **Consent Record**: the Issuer's record that an Agent accepted a Relying Party's disclosure for a set of scopes (Section 6.4).
- **Account**: the relationship between one Agent and one Relying Party, created at the first successful sign-in (Section 7.4).
- **Open Client**: a Relying Party identified by a Client ID Metadata Document, without registration (Section 4.2).
- **Registered Client**: a Relying Party registered with the Issuer (Section 4.3).
- **Owner Credential**: a bearer credential the Issuer gives the Owner after authentication by a method of Section 7.5.
- **Delegated Credential**: a bearer credential the Owner derives from an Owner Credential for an Agent, limited to the operations Section 7.8 marks as delegable.

### 1.3 Overview

A sign-in proceeds as follows:

1. The Relying Party sends the Session Holder to the Issuer's Authorization Endpoint with an Authentication Request (Section 5.1).
2. The Issuer creates a Sign-in Transaction, binds the Session Holder to it, and answers with the Transaction Resource or with a wait page that embeds it (Section 5.3).
3. The Agent Client reads the transaction, signs its challenge with the Agent Key and posts the assertion (Section 6.3).
4. The Issuer verifies the key, the Account, the per-owner cap, the Owner's policy and the Consent Record, and sets the transaction's status to `ready`, `awaiting_owner` or `awaiting_consent` (Sections 6.2, 6.3).
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

This document profiles OpenID Connect Core 1.0: Authorization Code Flow only, PKCE with `S256` [RFC7636], ES256 signatures, short-lived tokens, no Refresh Tokens (Section 5.6), Issuer identification on the redirect [RFC9207], and Client ID Metadata Documents [CIMD] for unregistered Relying Parties. Sections 3 to 5 use the OpenID Connect message shapes, adding the Claims of Section 3.1, the JSON response of Section 5.3 and the error code of Section 5.5; the Relying Party additions are steps 6 and 7 of Section 5.7 and Section 9. Sections 6 and 7 define the Agent side, which OpenID Connect leaves to the provider.

Beyond the scope of this specification: delegation chains between agents, payments, reputation or trust scores, mail delivery to a handle, how Agents and Owners are created at an Issuer, how an Owner authenticates to an Issuer and obtains Owner or Delegated Credentials, how an Issuer stores keys, and how Agent Clients discover Relying Parties.

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

A handle names an Agent; its domain names the Home Issuer by WebFinger (Section 2.2) or, failing that, DNS (Section 2.3). Sections 2.5, 6.3 and [Relay Profile] define who performs discovery and when.

### 2.1 Handle Syntax

```
handle  = local "@" domain
local   = dot-atom-text          ; Section 3.2.3 of [RFC5322], ASCII only
domain  = <domain name per Section 2.3.1 of [RFC1035] as relaxed by Section 2.1 of [RFC1123];
           every label an LDH-label or A-label [RFC5890]>
```

The `local` part is limited to 64 octets and the handle to 254 octets (Section 4.5.3.1 of [RFC5321]). Internationalised local parts [RFC6530] are not supported in this version. Two handles are equal when their `local` parts are octet-for-octet equal and their domains are equal after conversion to lower-case A-labels. An Issuer SHOULD register `local` parts in lower case. The corresponding URI is `acct:` followed by the handle, any octet of `local` not permitted in `userpart` percent-encoded (Section 7 of [RFC7565]).

### 2.2 WebFinger Lookup

The requester sends `GET /.well-known/webfinger?resource=acct:{handle}&rel=http://openid.net/specs/connect/1.0/issuer`, percent-encoded, to the handle's domain over HTTPS (Appendix A.1). The response is a JRD; the `href` of the first link whose `rel` is `http://openid.net/specs/connect/1.0/issuer` is the Issuer Identifier, as in Section 2 of [OpenID.Discovery]. The lookup has failed, and MUST NOT be retried over HTTP, when `href` is not an `https` URL without query or fragment, the certificate is invalid, the status is 4xx other than `404` or 5xx, or the connection fails; a `404`, a JRD without a matching link, or a domain with no A or AAAA record permits the DNS fallback of Section 2.3. A domain MAY delegate by answering with a 3xx status and a `Location` on another host (Section 7 of [RFC7033]); the requester MUST follow at most five redirects and MUST require HTTPS at each hop.

For every request to a URL learned through discovery, including the WebFinger lookup, the Issuer metadata, the JWK Set and the endpoints the metadata names, the requester MUST resolve the host, MUST NOT connect to an address that the IANA Special-Purpose Address Registries [RFC6890] [RFC8190] mark as not globally reachable, treating an IPv4-mapped (`::ffff:0:0/96`) or IPv4-embedded (`64:ff9b::/96`) IPv6 address as its embedded IPv4 address, MUST connect only to the address it checked, MUST repeat the check at every redirect hop, MUST verify the server's identity per [RFC9525], MUST limit the response to N_FETCH, and MUST send no credentials other than those Sections 3.3 and 5.6 define. A requester MUST reject metadata whose `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri`, `transaction_endpoint` or `agents_endpoint` is not an `https` URL. The requester MUST verify that the `issuer` member of the metadata fetched from `{href}/.well-known/openid-configuration` equals `href`. Results are cached per HTTP caching rules for at most T_CACHE; a result reached through redirects is no fresher than its least fresh hop. A WebFinger server SHOULD NOT expose handle lists beyond the per-handle lookup.

### 2.3 DNS Fallback

When Section 2.2 permits it, the requester MAY query the TXT record at `_agentlogin.{domain}`:

```
_agentlogin.example.com.  IN TXT  "v=agentlogin1; iss=https://issuer.example"
```

The requester concatenates the character-strings of each TXT record (Section 3.3 of [RFC7208]); when more than one record at the name begins with `v=agentlogin1`, all MUST be ignored. The requester MUST accept the record only when the response was DNSSEC-validated (AD bit, Section 3.2.3 of [RFC4035]), locally or by a validating resolver reached over a trusted channel [RFC4033]; an unvalidated record MUST be discarded. `iss` MUST be an `https` URL without query or fragment. A record without `v=agentlogin1`, or with more than one `iss`, MUST be ignored. The requester MUST then fetch the Issuer's metadata and check that `handle_domains` matches the domain (Section 2.4).

### 2.4 Issuer Metadata

An Issuer MUST publish metadata at `{Issuer Identifier}/.well-known/openid-configuration` per [OpenID.Discovery], using the member definitions of [RFC8414], with the following values:

- `response_types_supported`: MUST contain `code` and SHOULD contain nothing else. `response_modes_supported`: `["query"]`.
- `grant_types_supported`: `["authorization_code"]`.
- `code_challenge_methods_supported`: MUST contain `S256`; MUST NOT contain `plain`.
- `id_token_signing_alg_values_supported`: MUST contain `ES256`; MAY contain `Ed25519`; MUST NOT contain other algorithms. This departs from Section 15.1 of [OpenID.Core] and Section 3 of [OpenID.Discovery], which require `RS256`; a Relying Party MUST configure a library that defaults to `RS256` to expect `ES256`.
- `token_endpoint_auth_signing_alg_values_supported`: REQUIRED when `private_key_jwt` is offered; MUST contain `ES256`; MUST NOT contain `none`.
- `request_parameter_supported`, `request_uri_parameter_supported`: `false` (Section 5.1).
- `userinfo_endpoint`: REQUIRED (Section 3.3). `registration_endpoint`: REQUIRED when the Issuer supports [RFC7591].
- `agent_key_algs_supported`: REQUIRED. JWS algorithms accepted in assertions and enrollment proofs; MUST contain `ES256`; MAY contain `Ed25519`; MUST NOT contain other algorithms.
- `subject_types_supported`: `["public"]`; this version defines no `pairwise` subjects.
- `authorization_response_iss_parameter_supported`: `true`.
- `client_id_metadata_document_supported`: `true`.
- `scopes_supported`: MUST contain `openid`, `email`, `profile`, `owner_profile` and `owner_email`.
- `token_endpoint_auth_methods_supported`: MUST contain `none` and `client_secret_basic`; MAY contain `client_secret_post`; SHOULD contain `private_key_jwt`.
- `transaction_endpoint`: REQUIRED. HTTPS URL under which Transaction Resources are served (Section 6.1).
- `agents_endpoint`: REQUIRED. HTTPS URL under which Agent management resources are served (Section 7.8).
- `handle_domains`: REQUIRED. JSON array of domains the Issuer serves, as lower-case A-labels; a leading `*.` matches one or more subdomain labels. A Relay that serves no domains publishes `[]`.
- `home_issuers`: REQUIRED for a Relay, absent otherwise. JSON array of the Issuer Identifiers the Relay accepts, or `["*"]` when it accepts any Home Issuer passing a rule it MUST document at `op_policy_uri`.
- `op_policy_uri`: REQUIRED for a Relay [RFC8414] or an Issuer enforcing Section 7.6 caps; RECOMMENDED otherwise.
- `agent_login_versions_supported`: REQUIRED. JSON array of strings; this document defines `1.0`.

An Issuer MUST NOT publish an `end_session_endpoint`.

### 2.5 Binding a Handle to its Issuer

For an ID Token carrying `email`, a Relying Party MUST verify that discovery for that handle yields `iss`. A known expected handle MUST be bound to `state`, sent as `login_hint` and compared with any returned `email` under Section 2.1; a callback parameter cannot replace that binding.

For a token carrying `home_iss`, `iss` MUST instead be a configured Relay, discovery for `email` or the expected handle bound to `state` MUST yield `home_iss`, and that value MUST satisfy the Relay's `home_issuers`. Without either handle the token MUST be rejected; Relay use without `email` therefore requires a pre-bound `login_hint`.

Moving a handle to another Issuer does not preserve (`iss`, `sub`). Relying Parties MUST NOT merge Accounts solely because handles match; account migration is outside this specification.

## 3. The ID Token and UserInfo Response

The ID Token is as defined in Section 2 of [OpenID.Core] with the Claims and constraints below; Section 4.1 maps scopes to Claims.

### 3.1 Claims

- `iss`: REQUIRED. Issuer Identifier of the Issuer that signed the token.
- `sub`: REQUIRED. Opaque identifier of the Agent: a base64url string of at least N_ENTROPY and at most 255 characters (Section 2 of [OpenID.Core]), stable for one Agent at every Relying Party (`public` subject type), different for every Agent, and never derivable from the handle. Deleting an Agent and creating one with the same handle MUST produce a new value.
- `aud`: REQUIRED. The Relying Party's `client_id`, as a single string.
- `exp`, `iat`: REQUIRED. `exp` minus `iat` MUST NOT exceed T_TOKEN.
- `jti`: REQUIRED. Unique identifier of this token.
- `nonce`: REQUIRED. The value from the Authentication Request (Section 5.1).
- `auth_time`: OPTIONAL; REQUIRED when the Authentication Request carried `max_age`. Time the assertion was accepted (Section 6.3 step 7).
- `actor_type`: REQUIRED. Value MUST be `agent`.
- `scope`: REQUIRED. Space-delimited scope values granted in this sign-in [RFC8693].
- `email`: The Agent Handle. `email_verified`: MUST be `true`. An Issuer MUST NOT issue either Claim unless its `handle_domains` matches the handle's domain (Section 2.4) and the Agent is enabled; for a Relay, see [Relay Profile], Section 3.
- `name`: Display name of the Agent; omitted when none is set.
- `preferred_username`: Short name of the Agent, not guaranteed unique.
- `owner_sub`: Opaque identifier of the Owner with the same syntax as `sub`, identical for every Agent of one Owner at every Relying Party of one Issuer and never derivable from the Owner's address.
- `owner_name`: Display name of the Owner.
- `owner_email`: Address of the Owner. `owner_email_verified`: MUST be `true`; an Issuer that cannot assert it MUST NOT issue these Claims.
- `owner_verified_via`: REQUIRED when `owner_name` or `owner_email` is present. One value of Section 7.5, as a single string.
- `home_iss`: REQUIRED in a token issued by a Relay (Section 8); MUST NOT appear otherwise. Issuer Identifier of the Home Issuer.

Ungranted Claims MUST be omitted, not set to `null` or empty. Other Claims MAY be present; Claims not understood MUST be ignored.

### 3.2 Signing

The ID Token MUST be a JWS signed with `ES256` [RFC7518]; an Issuer MAY additionally offer `Ed25519` [RFC9864] with the key representation of [RFC8037] when advertised in its metadata. The JOSE header MUST contain `alg` and `kid`, SHOULD contain `typ` with the value `JWT`, and MUST NOT contain `jwk`, `jku`, `x5u` or `x5c`. The signing key MUST be published in the Issuer's JWK Set under that `kid` (Section 7.7). A client MAY state `id_token_signed_response_alg` [OpenID.Registration]; the Issuer MUST sign with that value when it is `ES256` or an advertised `Ed25519`, MUST reject other values (`invalid_client_metadata` at registration, `invalid_request` for an Open Client), and MUST sign with `ES256` when it is absent.

### 3.3 UserInfo and Live State

The UserInfo Endpoint returns the Claims of Section 3.1 other than `aud`, `exp`, `iat`, `jti` and `nonce`, as a JSON object, for a valid Access Token presented as a bearer token [RFC6750]. The `sub` value MUST equal the ID Token's. The Issuer MUST evaluate the Agent's current state on every request and MUST answer `401` with `WWW-Authenticate: Bearer error="invalid_token"` once the Agent Key that asserted the sign-in is revoked or expired, the Agent is deleted or disabled, or the Account is disabled.

### 3.4 Example

Example Claims of an ID Token issued to the Registered Client `s6BhdRkqt3`, which requested `openid email profile owner_email`:

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

The `scope` parameter is space-delimited; values not listed here MAY be present and MUST be ignored by the Issuer unless defined by an extension.

| Scope | Tier | Claims delivered |
| --- | --- | --- |
| `openid` | all | REQUIRED in every request; `sub` and the Claims every token carries (Section 3.1) |
| `email` | all | `email`, `email_verified` |
| `profile` | all | `name` (if set), `preferred_username`, `owner_sub` |
| `owner_profile` | Registered Clients | `owner_name`, `owner_verified_via` |
| `owner_email` | Registered Clients | `owner_email`, `owner_email_verified`, `owner_verified_via` |

### 4.2 Open Clients

An Open Client identifies itself with a `client_id` that is the HTTPS URL of its Client ID Metadata Document [CIMD] (compare [IndieAuth]). The URL MUST satisfy Section 3 of [CIMD]: `https` scheme, a host that is a domain name rather than an IP literal, a non-empty path, no userinfo, no fragment, no `.` or `..` path segments; the Issuer MUST reject other values with `invalid_request` without fetching. The document MUST contain `client_id` equal to that URL, `redirect_uris`, and `token_endpoint_auth_method` with the value `none`; it SHOULD contain `client_name`, `logo_uri`, `tos_uri`, `policy_uri` and `initiate_login_uri`. The Issuer MUST fetch the document when it first sees the `client_id` and on cache expiry, applying the protections of Section 2.2; it MUST NOT follow redirects, MUST require a JSON content type and a `200` status, MUST reject documents larger than N_CIMD, and MAY cache per HTTP caching rules. `redirect_uris` MUST NOT contain `http` or loopback URIs (matching: Section 5.2). An Open Client MAY request `openid`, `email` and `profile`; a request containing `owner_profile` or `owner_email` MUST fail with `invalid_scope`.

### 4.3 Registered Clients

A Registered Client is created by Dynamic Client Registration [RFC7591] with an initial access token or by a mechanism the Issuer operates; an Issuer MUST support at least one. The Issuer assigns an opaque `client_id` and either a `client_secret` or accepts a JWK Set for `private_key_jwt` [RFC7523]. A Registered Client authenticates at the Token Endpoint with one of `client_secret_basic` [RFC7617], `client_secret_post` or `private_key_jwt` (RECOMMENDED) as advertised in the Issuer's metadata, MAY register loopback IP literal redirect URIs for development (`localhost` as a host name is NOT RECOMMENDED, Section 8.3 of [RFC8252]), MAY request `owner_profile` and `owner_email`, and MUST publish `tos_uri` and `policy_uri` when it requests `owner_email`. A registration request MUST include `redirect_uris` and `token_endpoint_auth_method`, and `jwks` or `jwks_uri` for `private_key_jwt`; `grant_types` other than `authorization_code`, `response_types` other than `code`, `token_endpoint_auth_method` `none`, and an `id_token_signed_response_alg` the Issuer does not offer MUST be rejected with `invalid_client_metadata` (Section 3.2.2 of [RFC7591]).

### 4.4 Client Metadata Used by this Specification

The following client metadata are used in Client ID Metadata Documents and registration requests:

- `max_signups_per_owner`: OPTIONAL. Integer from 0 to 1000000. Maximum number of Accounts the Issuer creates for Agents of one Owner at this client (Section 7.6). Absent means unlimited; `0` pauses new sign-ups.
- `require_review`: OPTIONAL. Boolean, default `false`. When `true`, every sign-in at this client includes the review step of Section 6.4.
- `initiate_login_uri`: OPTIONAL. Defined by [OpenID.Registration]; used by Agent-initiated start (Section 5.8).
- `relay_issuer`: OPTIONAL in registration requests, absent from Client ID Metadata Documents. The Issuer Identifier of a Relay (Section 8) registering as a client. The Issuer MUST verify that the host, with any port, of every `redirect_uri` registered equals that of the Issuer Identifier, obtains the Relay's `op_policy_uri` from its metadata (Section 2.4), and uses both in Section 6.6.

## 5. Authentication

Communication with every endpoint of Sections 5 to 7 MUST use TLS per BCP 195 [BCP195], with server identity verified per [RFC9525]. Every response of the UserInfo Endpoint, of a registration endpoint and of Sections 5 to 7, including redirects and excepting the JWK Set (Section 7.7), MUST carry `Cache-Control: no-store`; the Token Response MUST also carry `Pragma: no-cache` (Section 5.1 of [RFC6749]).

### 5.1 Authentication Request

The Relying Party sends the Session Holder to the Authorization Endpoint with the following parameters, by `GET` in the query component or by `POST` as an `application/x-www-form-urlencoded` body; the Issuer MUST accept both (Section 3.1.2.1 of [OpenID.Core]):

- `response_type`: REQUIRED. MUST be `code`.
- `client_id`: REQUIRED. The Open Client's document URL or the Registered Client's identifier.
- `redirect_uri`: REQUIRED.
- `scope`: REQUIRED. MUST contain `openid`.
- `state`: REQUIRED. Opaque value of at least N_ENTROPY, bound to the Session Holder's session at the Relying Party.
- `nonce`: REQUIRED. Opaque value of at least N_ENTROPY, returned in the ID Token.
- `code_challenge`, `code_challenge_method`: REQUIRED for every client. `code_challenge_method` MUST be `S256` [RFC7636].
- `response_mode`: OPTIONAL. If present, MUST be `query`; other values MUST be rejected with `invalid_request`.
- `prompt`: OPTIONAL. `consent` forces the review step (Section 6.4); `none` forbids interaction (Section 6.3 step 10). Other values MUST be ignored.
- `login_hint`: OPTIONAL. The expected Agent Handle; REQUIRED when the Relying Party knows it (Section 2.5).
- `max_age`: OPTIONAL. Non-negative integer seconds. Zero requires a fresh assertion for this Authentication Request [OpenID.Core]. For a positive value, the Issuer MUST NOT authorize a code or tokens when current time minus `auth_time` exceeds it; stale transactions before code issuance end `denied`/`login_required`. Approval does not refresh `auth_time`; a new sign-in requires a new transaction.

`request` and `request_uri` are not supported: a request carrying either MUST be rejected with `request_not_supported` or `request_uri_not_supported` (Sections 6.1, 6.2 and 3.1.2.6 of [OpenID.Core]). `claims`, `display`, `ui_locales`, `id_token_hint` and `acr_values` MUST be ignored. `auth_time` is REQUIRED when `max_age` is present (Section 3.1). Invalid values fail with `invalid_request`; zero requests active authentication, not a zero-length delivery window. Example:

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
2. Verify that `redirect_uri` matches a registered or documented value by simple string comparison; for a loopback IP literal URI registered by a Registered Client (`http://127.0.0.1:{port}/...` or `http://[::1]:{port}/...`) the port MAY differ (Section 7.3 of [RFC8252]; Section 4.1.3 of [RFC9700]). If it does not match, the Issuer MUST NOT redirect and MUST answer `400` directly: with the JSON error body of Section 6.7 and `error` `invalid_request` when the request prefers `application/json` (Section 5.3), otherwise as HTML.
3. Reject the request with `invalid_request` if `state`, `nonce`, `code_challenge` or `code_challenge_method` is missing or invalid, or if any parameter is repeated, and with `unsupported_response_type` if `response_type` is not `code`. The Issuer MUST NOT reject `state` or `nonce` on length alone; N_ENTROPY binds the Relying Party.
4. Reject with `invalid_scope` a scope the client's tier does not permit.

If step 1 or 2 fails, the Issuer MUST NOT redirect and MUST answer `400` directly: with the JSON error body of Section 6.7 and `error` `invalid_request` when the request prefers `application/json` (Section 5.3), otherwise as HTML. If step 3 or 4 fails after steps 1 and 2 succeeded, no transaction is created and the Issuer MUST respond per Section 4.1.2.1 of [RFC6749]: on the HTML path, `303` to `redirect_uri` with `error`, `error_description`, `state` when received, and `iss`; on the JSON path, `400` with the body of Section 6.7 extended by a `redirect` member holding that URL.

### 5.3 Transaction Creation and Session Binding

On a valid request the Issuer creates a Sign-in Transaction (Section 6) with lifetime T_TXN and a transaction identifier of at least N_ENTROPY, and binds the Session Holder to it. The response depends on the request's `Accept` header, evaluated per Section 12.5.1 of [RFC9110]; an absent header or `*/*` is treated as `text/html`:

- When `application/json` is the highest-weighted acceptable type and outranks `text/html`, the Issuer MUST respond `200` with the Transaction Resource (Section 6.1) including a `session_token`: a bearer credential of at least N_ENTROPY, bound to this transaction, that identifies the Session Holder (Section 6).
- Otherwise the Issuer MUST respond `303` to a wait page and MUST bind the Session Holder with a session cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain` attribute, path limited to the Issuer's own resources) that identifies it in Section 6.5; the cookie is set only in this `303` response, and the Issuer MUST NOT bind a requester to the transaction on any later request. The `200` response of the wait page MUST carry a `Link` header `<{url}>; rel="agent-login-transaction"` naming the Transaction Resource, and its HTML MUST contain `<script type="application/json" id="agent-login-transaction">` whose text is the Transaction Resource as of page generation, serialised with `<`, `>`, `&`, U+2028 and U+2029 escaped as `\u003c`, `\u003e`, `\u0026`, `\u2028` and `\u2029`. The wait page SHOULD poll the Transaction Resource and follow the continue step when `next.action` becomes `continue`.

Every HTML page the Issuer serves to a user agent, including wait, review and Owner approval pages, MUST be sent with a `Content-Security-Policy` whose `script-src` is the Issuer's own origin without `'unsafe-inline'` and which sets `object-src 'none'`, `base-uri 'none'` and `frame-ancestors 'none'`, and with `Referrer-Policy: no-referrer`. Client-supplied strings MUST be rendered as text, and `logo_uri`, `tos_uri` and `policy_uri` MUST be `https` URLs or MUST be dropped.

### 5.4 Successful Response

When the transaction reaches `completed` (Section 6.5), the Issuer redirects the Session Holder to `redirect_uri` with:

- `code`: REQUIRED. Authorization Code, single use, valid for T_CODE.
- `state`: REQUIRED. The request's value.
- `iss`: REQUIRED. The Issuer Identifier [RFC9207].

The Issuer SHOULD invalidate tokens derived from a code presented twice, including tokens issued concurrently. A presentation failing the client, redirect URI or PKCE checks MUST NOT consume the code or invalidate tokens.

### 5.5 Error Response

Errors are returned per Section 4.1.2.1 of [RFC6749] with `error`, OPTIONAL `error_description` and `error_uri`, `state` and `iss`, to a validated `redirect_uri` only, directly (Section 5.2) or at the continue step (Section 6.5). Error codes are those of [RFC6749], `interaction_required`, `login_required`, `consent_required`, `request_not_supported` and `request_uri_not_supported` from Section 3.1.2.6 of [OpenID.Core], and:

- `signup_limit_reached`: the Owner's Agents have reached `max_signups_per_owner` at this client (Section 7.6).

Transaction outcomes map to errors as follows:

| Status, `reason` | `error` | `error_description` |
| --- | --- | --- |
| `denied`, `cancelled` / `access_denied` / `key_revoked` | `access_denied` | absent |
| `denied`, `owner_declined` | `access_denied` | `owner_declined` |
| `denied`, `consent_required` | `consent_required` | absent |
| `denied`, `interaction_required` | `interaction_required` | absent |
| `denied`, `login_required` | `login_required` | absent |
| `denied`, `signup_limit_reached` | `signup_limit_reached` | absent |
| `expired` | `access_denied` | `transaction_expired` |

### 5.6 Token Request and Response

The Relying Party presents `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier` and, for an Open Client, `client_id`; a Registered Client authenticates per Section 4.3. The Issuer MUST verify that the code was issued to the authenticated Registered Client or to the presented Open Client `client_id` (Section 4.1.3 of [RFC6749]), that `redirect_uri` equals the request's, and that `code_verifier` matches the challenge; it MUST answer `invalid_grant` when any of these fails, when `code_verifier` is absent, or when the code is unknown, expired, used, or belongs to a transaction whose asserting key was revoked or expired, whose Agent was disabled or deleted, or whose Account was disabled (Sections 7.3, 7.4). Failed client authentication is answered with `401` `invalid_client` (Section 5.2 of [RFC6749]). The successful response is per Section 3.1.3.3 of [OpenID.Core] with `access_token`, `token_type` `Bearer`, `expires_in` (T_TOKEN), `id_token` and `scope`, all REQUIRED. A code MUST be redeemed at most once, atomically with respect to concurrent Token Requests. The Issuer MUST NOT issue Refresh Tokens. The Access Token is opaque to the Relying Party and MUST be accepted only at the UserInfo Endpoint.

Redemption and token issuance MUST satisfy Section 7.4's current identity and lifecycle checks. A code authorises at most one token set; a retry or lost response MUST NOT extend token validity or permit another redemption. If authentication no longer satisfies `max_age` (Section 5.1), the Token Request MUST fail with `invalid_grant`.

### 5.7 ID Token Validation

The Relying Party MUST validate the response as follows:

1. Require one non-empty `state`, one non-empty `iss` and either non-empty `code` or `error`; reject mixed or duplicate protocol response members, but preserve unrelated query parameters in `redirect_uri`. Verify the session-bound `state`, its recorded Issuer and that state is unconsumed, then consume it. On error, report without a Token Request; otherwise send the Token Request only to that Issuer.
2. Verify the JWS signature with the key named by `kid` in the Issuer's JWK Set, refetching the JWK Set once when `kid` is unknown. `alg` MUST be in the Relying Party's configured set, which SHOULD be `ES256` alone or with `Ed25519`, and MUST match the key (Section 1.1) and equal the JWK's `alg` member when present (Section 4.4 of [RFC7517]). The Relying Party SHOULD rate-limit refetches triggered by unknown `kid` values. A cached JWK Set MUST expire by its HTTP freshness lifetime or T_CACHE, whichever is shorter; failed refreshes cannot extend it, and successfully refreshed sets replace older keys.
3. Verify that `iss` equals the recorded Issuer Identifier and `aud` equals the `client_id`.
4. Verify that the current time is before `exp` and not more than T_SKEW before `iat`; when `max_age` was requested, require `auth_time` and verify Section 5.1's age bound, or, for zero, that authentication occurred for this request.
5. Verify that `nonce` equals the request's value.
6. Verify that `actor_type` equals `agent`.
7. When `email` or `home_iss` is present, verify the binding of Section 2.5.

If any step fails, the ID Token MUST be rejected. State MUST remain consumed after a failed or uncertain exchange. Relying Parties SHOULD coordinate consumption atomically across serving instances, rejecting concurrent duplicates before exchange.

### 5.8 Agent-Initiated Start

The Agent Client sends the Session Holder to the Relying Party's `initiate_login_uri` [OpenID.Registration] with `iss` and `login_hint` as defined in Section 4 of [OpenID.Core]. The Relying Party MUST verify that `iss` equals an Issuer it is configured to accept or, when it accepts Issuers by discovery (Section 9 item 10), the Issuer that discovery for `login_hint` yields, and MUST refuse the request with `400` otherwise; it MUST NOT send a request to an `iss` it has not accepted in this way; it then starts an Authentication Request to that Issuer carrying the same `login_hint` and records the Issuer for the `state` (Section 5.7). `target_link_uri`, if present, MUST be ignored or verified to point to the Relying Party's own origin before use, and `initiate_login_uri` MUST accept `GET` and `POST` (Section 4 of [OpenID.Core]). Discovery of Relying Parties is out of scope (Section 1.4); see [RFC9728] and [auth.md].

## 6. The Sign-in Transaction

Every Transaction Resource and JSON transaction-error response for an existing transaction MUST carry the current `status` and the `next` step. Successful continue responses instead use the redirect forms of Section 6.5. Requests from an Agent Client to the transaction endpoint carry no cookies and need no anti-forgery token: the assertion signature, the `transaction_token` and the `session_token` are its only authorities, each token presented as `Authorization: Bearer` on requests to the transaction's resources, including `GET` of the Transaction Resource and of the continue URL (Section 6.5). Agent Clients MUST validate server certificates and MUST NOT follow a redirect from HTTPS to HTTP. An Issuer that supports browser-based Agent Clients on other origins MUST answer CORS preflight requests for the transaction and agents endpoints and MUST NOT set `Access-Control-Allow-Credentials` to `true`. Transaction identifiers MAY be logged; assertions, tokens, challenges, continue URLs and, while its code is unredeemed, the redirect URL of Section 6.5 MUST NOT be logged, and an Agent Client MUST NOT place them in model prompts or tool output.

### 6.1 Transaction Resource

`GET {transaction_endpoint}/{transaction_id}` with `Accept: application/json` returns:

- `transaction_id`: REQUIRED. The identifier. Possession of it alone MUST grant nothing beyond reading this representation (Section 10.1).
- `iss`: REQUIRED. Issuer Identifier of the Issuer serving the transaction.
- `url`: REQUIRED. Absolute HTTPS URL of this Transaction Resource.
- `status`: REQUIRED. One of the values in Section 6.2.
- `next`: REQUIRED. Object: `action` (Section 6.2); `method` and `url` (absolute HTTPS URL), REQUIRED unless `action` is `none` or Section 6.5 withholds `url`; `retry_after` (seconds), REQUIRED for `await_owner` and `follow`.
- `expires_at`: REQUIRED. Expiry of the transaction, seconds since 1970-01-01T00:00:00Z.
- `client`: REQUIRED. Object with `client_id`, `client_type` (`open` or `registered`), `redirect_host` (the host, with any port, of the request's `redirect_uri`), and the client's `client_name`, `logo_uri`, `tos_uri` and `policy_uri` when known.
- `requested_scopes`: REQUIRED. Array of scope values.
- `disclosure`: REQUIRED. Array of objects `{scope, title, description}`, one per requested scope, describing what the client receives. It MUST NOT change during the transaction's lifetime.
- `requester`: OPTIONAL. Object describing the Session Holder as seen by the Issuer: `user_agent` and `network` (a coarse network location), as strings. Both values are controlled by the Session Holder and MUST NOT decide `deliver_to_session`.
- `challenge`: REQUIRED while `status` is `awaiting_agent` and `next.action` is `assert`. Opaque value of at least N_ENTROPY, single use.
- `consent_reason`: REQUIRED while `status` is `awaiting_consent`. One of `first_visit`, `material_change`, `expired`, `prompt_consent`, `policy` (Section 6.4): the first of them that keeps the review outstanding.
- `login_hint`: OPTIONAL. The handle named in the Authentication Request.
- `reason`: REQUIRED when `status` is `denied`. One of `cancelled`, `access_denied`, `key_revoked`, `owner_declined`, `consent_required`, `interaction_required`, `login_required`, `signup_limit_reached`.
- `transaction_token`: present only in the response to a successful assertion (Section 6.3) or, at a Relay, as [Relay Profile], Section 4 describes.
- `session_token`: present only in the JSON `200` response of Section 5.3; valid until T_RETAIN after the transaction becomes terminal.

Members not understood MUST be ignored.

### 6.2 Statuses and Next Steps

| Status | Terminal | `next.action` | Agent Client does | Set by |
| --- | --- | --- | --- | --- |
| `awaiting_agent` | no | `assert`; at a Relay `identify` or `follow` | POST an assertion (Section 6.3); at a Relay POST the handle or GET the Home Issuer's resource ([Relay Profile], Section 4) | creation |
| `awaiting_owner` | no | `await_owner` | GET again after `retry_after` | Section 6.3 step 10, Section 6.4; [Relay Profile], Section 4 |
| `awaiting_consent` | no | `review` | POST a decision (Section 6.4) | Section 6.3 step 10, Section 6.6; [Relay Profile], Section 4 |
| `ready` | no | `continue` | GET the continue URL (Section 6.5) | Sections 6.3, 6.4, 6.6; [Relay Profile], Section 4 |
| `completed` | yes | `none` | nothing | Section 6.5 |
| `denied` | yes | `continue` | GET the continue URL (Section 6.5) | Sections 6.3, 6.4, 6.6, 7.3, 7.4; [Relay Profile], Section 4 |
| `expired` | yes | `continue` | GET the continue URL (Section 6.5) | expiry of `expires_at`; [Relay Profile], Section 4 |

A terminal transaction MUST remain readable by its identifier with `200` for T_RETAIN from its effective terminal time; the Issuer MAY then answer `404` `invalid_transaction`. Later events MUST NOT change its terminal outcome, restart retention or restore readability once removed; retention grants no extra credential validity.

Expiry takes effect when current time reaches `expires_at`, without requiring a request or write. An earlier asserting-key expiry instead yields `denied`/`key_revoked`; transaction expiry wins a tie. Polling MUST report this effective status without changing authority, consent or capacity, except for Relay hand-off processing ([Relay Profile], Section 4).

Assertion acceptance, its identity binding and signup reservation MUST take effect together; a losing duplicate MUST NOT release the winner's reservation. Completion, its single code, Account update and signup accounting MUST likewise succeed together under valid identity, reservation and expiry checks. These checks apply when authorization takes effect, including after contention; retries cannot create extra authority or extend lifetimes. T_SKEW does not extend transaction, code or key expiry.

### 6.3 Assertion

Before asserting, the Agent Client MUST verify that the resource's `iss` equals the Home Issuer discovered for its handle (Section 2) and that `url` and `next.url` are under that Issuer's `transaction_endpoint`. An Agent Client that reached the Authorization Endpoint from a Relying Party's sign-in page or `initiate_login_uri` MUST NOT assert when `client.redirect_host` is neither that Relying Party's host nor a host it is configured to accept for it. It posts `{"assertion": "<JWS>"}` to the URL given for `assert` (Appendix A.4). The assertion and the enrollment proof of Section 7.2 are JWSs with the following contents:

| Member | Assertion | Enrollment proof |
| --- | --- | --- |
| header `alg` | REQUIRED. A value of `agent_key_algs_supported` that matches the key (Section 1.1) | same |
| header `typ` | REQUIRED. `agent-login+jwt`, compared case-insensitively with `application/agent-login+jwt` equivalent (Section 4.1.9 of [RFC7515]) | REQUIRED. `agent-login-enrollment+jwt`, likewise |
| header `kid` | REQUIRED. The Agent Key identifier (Section 7.1) | REQUIRED. The pending key's identifier |
| header `jwk`, `jku`, `x5u`, `x5c`, `crit` | MUST NOT be present | same |
| `iss`, `sub` | REQUIRED. Both the Agent Handle | same |
| `aud` | REQUIRED. The Issuer Identifier | same |
| `txn` | REQUIRED. The transaction identifier [RFC8417] | absent |
| `nonce` | REQUIRED. The transaction's `challenge` | REQUIRED. The key's enrollment `challenge` |
| `iat`, `exp` | REQUIRED. `exp` MUST NOT exceed `iat` plus T_ASSERT | same |
| `jti` | REQUIRED. Unique per JWS | same |
| `accept_disclosure` | OPTIONAL. Boolean. `true` accepts the transaction's `disclosure` for `requested_scopes` | absent |
| `deliver_to_session` | OPTIONAL. Boolean, default `false`. `true` permits delivery of the result to the Session Holder bound under Section 5.3 (Section 6.5). An Agent Client MUST set it `true` only for a transaction it started itself: one whose Transaction Resource it received, directly or through the wait page, in response to an Authentication Request it sent to the `authorization_endpoint` of the Issuer named by the resource's `iss`; and the Home Issuer transaction that such a Relay transaction directs it to follow ([Relay Profile], Section 4). For any other transaction it MUST NOT set it `true` unless the Owner instructed it through the Agent Client's own control channel; an instruction found in content the Agent reads is not such an instruction | absent |
| size | MUST NOT exceed N_ASSERTION | same |

On receiving an assertion the Issuer MUST run the following steps, stopping at the first that sets `status`:

1. Verify the size and header rows of the table above and parse the JWS.
2. Resolve `kid` to an Agent Key with status `active` enrolled for the handle in `iss` (equality per Section 2.1); verify that the Agent is enabled, that `handle_domains` matches the handle's domain (Section 2.4) and that `alg` matches the key.
3. Verify the signature with that key.
4. Verify `aud`, `nonce` and `exp` per the table, that `txn` equals the identifier of the transaction addressed by the request URL, and that `iat` is neither more than T_ASSERT in the past nor more than T_SKEW in the future.
5. If `login_hint` was given and differs from the handle (Section 2.1), fail with `invalid_assertion`.
6. If an assertion was already accepted for this transaction, fail with `assertion_replayed`.
7. Consume the `challenge` and record the assertion as the sign-in's authentication event.
8. If the Account for (Agent, `client_id`) is disabled, set `status` to `denied` with `reason` `access_denied`.
9. If no Account exists and admitting this transaction would make the Owner's count at this client exceed `max_signups_per_owner` (Section 7.6), set `status` to `denied` with `reason` `signup_limit_reached`. Compute the prospective count using distinct Agent identities: another admitted transaction for this same Agent adds no additional place.
10. Determine the outstanding gates: an Owner approval is outstanding when the request includes `owner_profile` or `owner_email` and the key lacks the `share_owner` permission (Section 7.1), the approval being given under Section 6.6; a review is outstanding when Section 6.4 requires one and `accept_disclosure` is not `true`, or when `accept_disclosure` is `true` but Section 6.4 requires a review for a reason other than the Consent Record. If `prompt` was `none` and a review is outstanding, set `status` to `denied` with `reason` `consent_required`; if `prompt` was `none` and an Owner approval is outstanding, set `status` to `denied` with `reason` `interaction_required`. Otherwise, if `accept_disclosure` is `true` and no review is outstanding, create or renew the Consent Record; then set `status` to `awaiting_owner` if an Owner approval is outstanding, else to `awaiting_consent` if a review is outstanding, else to `ready`.

Steps 6 and 7 MUST be performed atomically with respect to other assertions for the same transaction. If any of steps 1 to 6 fails, the assertion MUST be rejected with the matching error of Section 6.7, and neither `status` nor `challenge` changes. Otherwise the Issuer answers `200` with the Transaction Resource including `transaction_token`: a bearer credential of at least N_ENTROPY, bound to this transaction and this key, and valid until the key is revoked or until T_RETAIN after the transaction becomes terminal.

### 6.4 Review and Consent

A Consent Record stores the immutable Agent identity, `client_id`, scopes, `redirect_host`, `client_name`, `tos_uri`, `policy_uri` and last-use time. A relying sign-in renews last use only on reaching `ready`. The four client values are material metadata, compared as displayed strings, with absence distinct from a present value. The Issuer MUST require a review when any of the following holds, and MUST NOT otherwise:

- no Consent Record exists for (Agent, `client_id`): `consent_reason` `first_visit`;
- a record exists but `requested_scopes` is not a subset of its scopes, or a stored client value changed: `material_change`;
- the record's last use is at least T_CONSENT ago, or the Issuer's shorter period has elapsed: `expired`;
- the request carried `prompt=consent`: `prompt_consent`;
- the client's `require_review` is `true`, or Issuer policy requires it: `policy`.

The Agent Client posts `{"decision": "allow"}` or `{"decision": "deny"}` to the URL given for `review` with `Authorization: Bearer {transaction_token}`; the session binding of Section 5.3 MUST NOT authorise this step. `allow` creates or renews the Consent Record and sets `status` to `awaiting_owner` if an Owner approval is still outstanding, else `ready`; `deny` sets `status` to `denied` with `reason` `cancelled`. The Issuer answers `200` with the Transaction Resource. A decision posted while `status` is not `awaiting_consent` MUST be refused with `invalid_request` (400), or `transaction_expired` (410) for a terminal transaction, and MUST NOT change the Consent Record. A Consent Record unused for T_CONSENT MUST be deleted.

Acceptance covers only the transaction's displayed scopes and metadata. The Issuer MAY union scopes with an unexpired record only when all material metadata matches; otherwise it MUST replace them with the accepted scopes. Concurrent acceptances obey this rule in their effective order, and a transition relying on consent MUST check its current scopes, metadata and expiry.

### 6.5 Completion

When `status` is `ready`, `denied` or `expired`, `next.url` is a continue URL containing at least N_ENTROPY. The Issuer MUST return it to a requester presenting the `transaction_token`, and to the Session Holder (session cookie or `session_token`) only if the accepted assertion carried `deliver_to_session` `true`; to any other requester the Issuer returns `next.action` `continue` without `url`. A `GET` of the continue URL answers, when the request prefers HTML (evaluated as in Section 5.3), `303` to the Relying Party's `redirect_uri` with the parameters of Section 5.4 or 5.5, and otherwise `200` with `{"redirect": "<that URL>"}`. For `ready`, the Issuer MUST first check `max_age` (Section 5.1), denying with `reason` `login_required` when exceeded; otherwise it issues one code atomically and sets `completed`. Reuse answers `410`. For `denied` and `expired` the continue URL MAY be repeatable; if single-use, reuse answers `410` `transaction_expired`. The continue URL is followed with the credential that released it; a request without a valid one answers `401` `invalid_token`. An Agent Client whose accepted assertion carried `deliver_to_session` `true` MUST NOT follow the continue URL, and one that follows the `303` MUST NOT forward its `Authorization` header to the Relying Party.

### 6.6 Owner Approval

When `status` is `awaiting_owner`, the Issuer notifies the Owner. Approval, refusal and granting `share_owner` MUST require an authenticated Owner session with a factor the Agent cannot obtain or exercise, including through that factor's enrollment or recovery. This applies to every method, including OIDC and passkeys: an email link, method label or upstream `email_verified` alone is insufficient.

The approval page MUST show the client, including its `redirect_host`, the requested Owner Claims and the Agent Handle; when the client registered `relay_issuer` (Section 4.4), the page MUST say that the client is a Relay and that the Owner Claims will be forwarded to Relying Parties of that Relay under its `op_policy_uri`. Approval sets `status` to `awaiting_consent` if a review is still outstanding, else `ready`; refusal sets `status` to `denied` with `reason` `owner_declined`. While `status` is `awaiting_owner` the Issuer MAY extend `expires_at` up to T_OWNER after creation; the Agent Client MUST re-read it on every poll. The Issuer MUST NOT issue a token that omits an Owner Claim the client requested; when it cannot supply one for this Owner, it sets `status` to `denied` with `reason` `access_denied` at step 10 of Section 6.3.

### 6.7 Transaction Errors

Errors are returned with an HTTP status and a JSON body `{error, error_description, status, next}`, where `error` is REQUIRED, `error_description` OPTIONAL, and `status` and `next` are present whenever the transaction exists, `next.url` subject to Section 6.5. When several apply, the Issuer answers with the first of `invalid_transaction`, `invalid_token`, `transaction_expired`, then any other:

- `invalid_request` (400): malformed body or parameters.
- `invalid_transaction` (404): unknown transaction identifier, or a terminal transaction the Issuer no longer retains.
- `transaction_expired` (410): an assertion or decision on a terminal transaction, or reuse of a single-use continue URL (the retained resource still answers `200`, Section 6.2).
- `invalid_assertion` (400): the assertion fails step 1, 4 or 5 of Section 6.3, or its `alg` does not match the key (step 2); also an enrollment proof failing the checks of Section 7.2, in which case `status` and `next` are absent.
- `unknown_key` (401): `kid` resolves to no enrolled key for the handle, the handle's domain is not served, or the Agent is disabled or deleted.
- `key_revoked` (401): the key exists but is not `active`.
- `invalid_signature` (401): the signature does not verify.
- `assertion_replayed` (409): the transaction already accepted an assertion.
- `invalid_token` (401): the `transaction_token` or `session_token` is missing, wrong or no longer valid.
- `rate_limited` (429): the requester exceeded the Issuer's limits; `Retry-After` MUST be present. An Issuer SHOULD limit transactions per client and per source address, SHOULD throttle repeated invalid assertions for one transaction, and SHOULD limit transactions concurrently `awaiting_owner` per Agent and per client.

## 7. Agents, Keys, Owners and Caps

### 7.1 Agent Keys

An Agent Key is an ECDSA key on curve P-256 (REQUIRED for Issuers to accept) or an Ed25519 key (OPTIONAL). Its identifier is the SHA-256 JWK Thumbprint of the public key [RFC7638], base64url-encoded. A key record has:

- `kid`: REQUIRED. The identifier.
- `status`: REQUIRED. `pending` until possession is proved, `active` thereafter, `revoked` after Section 7.3, `expired` after `expires_at`.
- `jwk`: REQUIRED. The public key with exactly the members `kty`, `crv`, `x` and, for P-256, `y`.
- `permissions`: REQUIRED. Object; `share_owner` (boolean, default `false`) allows sign-ins that disclose Owner Claims without an Owner approval.
- `name`: OPTIONAL. Label chosen at enrollment.
- `created_at`, `expires_at`: REQUIRED. Seconds since 1970-01-01T00:00:00Z. `expires_at` defaults to `created_at` plus T_KEY and MUST NOT exceed `created_at` plus T_KEY_MAX.

A key whose `expires_at` has passed MUST be treated as not `active`. An Agent MAY hold several keys; an Issuer MUST allow at least two active keys per Agent. The private key MUST NOT leave the Agent Client; implementations SHOULD hold it in an operating-system keystore, a key management service or as non-extractable Web Cryptography API material, and MUST NOT place it in model prompts, tool output or logs.

### 7.2 Key Enrollment

`POST {agents_endpoint}/{handle}/keys` with body `{jwk, name, expires_at}` creates a `pending` key. The Issuer MUST reject a `jwk` with any member other than `kty`, `crv`, `x` and (for P-256) `y`, whose `kty` and `crv` are inconsistent, whose curve is not supported, whose `x` and `y` (P-256) or `x` (Ed25519) do not decode to exactly 32 octets, whose P-256 coordinates are not less than the field prime, whose Ed25519 encoding is not canonical, whose point is not on the curve, or, for Ed25519, whose point is the identity or of small order; MUST compare public keys by the decoded point; MUST reject, with `invalid_request`, a key previously revoked for this handle or already enrolled (`pending` or `active`) at this Issuer for any Agent; and SHOULD limit `pending` keys per handle (`rate_limited`). `permissions` in the body are ignored; `share_owner` is granted only by the update operation of Section 7.8. The response is `201` with the key record plus `challenge` (at least N_ENTROPY, single use, valid for T_ASSERT) and `proof_url`, an absolute HTTPS URL at the Issuer.

The Agent Client then posts `{"proof": "<JWS>"}` to `proof_url`; this request needs no credential. The Issuer MUST verify the proof per the Enrollment proof column of Section 6.3, with the signature verified by the pending key's `jwk` alone, `iss` and `sub` equal to the handle in the path, `nonce` equal to this key's unconsumed `challenge`, and `iat` checked as in Section 6.3 step 4. On success the Issuer sets `status` to `active` and answers `200` with the key record; on failure it answers with the matching error of Section 6.7. A `pending` key not proved within T_ASSERT MUST be deleted.

Enrollment and proof acceptance MUST remain bound to the same immutable Agent and enrollment; handle or `kid` reuse cannot transfer authority. An earlier proof or management request MUST NOT affect a replacement enrollment. Expired enrollments no longer occupy the current slot, but a new enrollment restores none of their authority.

### 7.3 Key Revocation

Revoking a key (Section 7.8) takes effect immediately (Section 7.4) and MUST NOT delete Consent Records or Accounts. `DELETE .../{handle}/keys` revokes every `pending` and `active` key of the handle and, when performed with an Owner Credential, MUST also invalidate every Delegated Credential derived for that handle. An Issuer SHOULD offer the Owner one operation that revokes every key of every Agent of that Owner with the same effects, and SHOULD notify the Owner of every key enrolled with a Delegated Credential. An Issuer MAY additionally send Back-Channel Logout [OpenID.BackChannel] or Shared Signals [OpenID.SSF] events to Relying Parties that registered for them.

Revocation MUST affect only the authorized enrollment. Owner revoke-all MUST invalidate keys and Delegated Credentials together, including against concurrent enrollment; it cannot leave new authority derived from a revoked credential.

### 7.4 Accounts

An Account is created at the first `completed` transaction for (Agent, `client_id`). Its record has `client_id`, `status` (`enabled` or `disabled`), `first_signed_in_at`, `last_signed_in_at` and `sign_in_count`, and SHOULD be visible to the Owner. Disabling an Account (Section 7.8) takes effect immediately as tabulated below; re-enabling restores sign-in and preserves the counters.

| Event | Open transactions | Later transactions | Unredeemed codes | Access Tokens | Consent Records, Accounts |
| --- | --- | --- | --- | --- | --- |
| Key revoked or expired | those it asserted: `denied`, `key_revoked`; assertions and proofs with it refused (`key_revoked`) | refused | `invalid_grant` (Section 5.6) | invalidated (Section 3.3) | unchanged |
| Account disabled | those for the pair past step 7 of Section 6.3: `denied`, `access_denied` | `denied`, `access_denied` (step 8) | `invalid_grant` | invalidated (Section 3.3) | Account `disabled`; Consent Record unchanged |
| Agent disabled | those it asserted: `denied`, `access_denied` | refused (`unknown_key`) | `invalid_grant` | invalidated (Section 3.3) | unchanged |
| Agent deleted | as disabled | as disabled | as disabled | as disabled | deleted; the count of Section 7.6 is retained |

“Open” means effectively nonterminal (Section 6.2). Once invalidation takes effect, subsequent assertion, completion, redemption, issuance and UserInfo decisions MUST reject the affected authority; re-enabling or re-enrollment MUST NOT restore it. A previously authorized response may arrive later, but its Access Token fails subsequent UserInfo checks.

Accounts and Consent Records belong to the immutable Agent, not its handle. Recreated Agents inherit neither, and concurrent first sign-ins MUST create at most one Account per Agent/client pair. Deleting an Owner deletes every Agent of that Owner.

### 7.5 Owner Verification

Before an Agent's first sign-in, the Issuer MUST verify its Owner by at least one method below and report a method actually used in `owner_verified_via`. The labels are not assurance levels.

- `email`: the Owner proved control of `owner_email` by a one-time code or link sent to it. Every Issuer MUST support this method.
- `oidc`: the Owner authenticated through an upstream OpenID Provider that asserted the address with `email_verified` `true`.
- `domain`: the Owner proved control of the domain of `owner_email` by DNS or a well-known resource.
- `passkey`: the Owner authenticated with a WebAuthn credential [WebAuthn] registered after one of the methods above.

`owner_verified_via` describes historical verification, not current session assurance. For an organisation, `owner_name` and `owner_email` name its designated contact. Every Issuer MUST support at least one authentication method satisfying Section 6.6, including its enrollment and recovery protections.

### 7.6 Per-Owner Sign-up Caps

A client MAY set `max_signups_per_owner`. Per (Owner, `client_id`), the Issuer counts every Account created during that Owner's existence, including deleted or disabled Accounts, plus distinct Agents without an Account whose transactions passed Section 6.3 step 9 and remain effectively open. Admission and completion MUST enforce this cap atomically, including when no Account yet exists; concurrent first completions count once.

Multiple pending transactions for one Agent consume one place, with separate claims: losing a request or ending one transaction MUST NOT release another's claim. Completion converts that place into one Account count without a gap or double count. Agent or Account deletion MUST NOT reduce the count.

An Issuer enforcing caps MUST publish at `op_policy_uri` one fixed, finite, positive retention period for counts after Owner deletion. Re-verifying the same address before that period ends inherits those counts, but no old identity, credentials or consent. The deletion deadline is fixed at deletion and MUST NOT be shortened or extended by later policy changes; on expiry, the Issuer MUST discard the deleted Owner's address-to-count linkage. Later verification starts fresh counting. Address changes of an existing Owner MUST NOT erase that Owner's counts; newly verified addresses inherit any still-retained counts. Each Account contributes once to inherited totals, including through repeated verification or address changes; inherited counts of a live Owner do not expire with an older deleted record. Retained counts and pending capacity for the same verified address are shared. Address equality compares parsed local-parts octet-for-octet and domains as lower-case A-labels; provider-specific aliases are not inferred. Re-verification proves address control, not the same human.

### 7.7 Issuer Signing Keys and Rotation

The Issuer MUST publish a JWK Set at `jwks_uri`, each key with stable `kid`, `use` `sig` and `alg`, and MUST NOT reuse a `kid` for different key material. It MUST publish a new key before use and retain the previous key for T_TOKEN plus the JWK Set's longest allowed cache lifetime after its last issuance. Cache lifetime MUST NOT exceed T_CACHE. A compromised or suspected-compromised key MUST cease signing and be removed immediately, overriding normal retention.

One active signing key per algorithm is RECOMMENDED. Signing keys SHOULD be held in a non-exportable hardware security module or key management service. Removal does not revoke already cached keys: an attacker can forge new token times until refresh. Section 5.7 bounds cache freshness; the implementation guide discusses emergency recovery.

### 7.8 Management Operations

Resources are served under `agents_endpoint`; `{handle}` and `{client_id}` in paths are percent-encoded. Every operation requires `Authorization: Bearer` with an Owner Credential of the Owner of the handle in the path or, where marked delegable, a Delegated Credential derived for that handle; the Issuer MUST verify that relationship on every request, MUST answer `401` with `WWW-Authenticate: Bearer error="invalid_token"` [RFC6750] for a missing or invalid credential, `403` with `WWW-Authenticate: Bearer error="insufficient_scope"` and body `error` `insufficient_permission`, changing nothing, for a Delegated Credential on an operation or part of one that is not delegable, and `404` for a handle that does not exist, does not belong to the credential's Owner, or is not the handle the Delegated Credential was derived for; `404` takes precedence over `403`. An Owner Credential obtained in a session that does not satisfy Section 6.6 MUST NOT grant `share_owner`.

Authorization MUST remain bound to the same immutable Owner, Agent and, where relevant, enrollment through the operation. Deleting and recreating a handle MUST NOT retarget an in-flight request or restore a Delegated Credential; fresh authorization is required.

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
| Set account status | `PATCH .../{handle}/accounts/{client_id}` | `{"status": "enabled"\|"disabled"}` | `200` account record | `disabled` only |
| Revoke consent | `DELETE .../{handle}/consents/{client_id}` | | `204` | yes |

Revoking a consent deletes the Consent Record and MUST NOT affect keys or Accounts.

## 8. Relay Profile

The [Relay Profile](relay-profile.md) specifies sign-in through an intermediary Issuer. A Relay authenticates the Agent at its Home Issuer and issues its own tokens; the Relying Party trusts the Relay as fully as an Issuer. Relay conformance is separate from direct sign-in.

## 9. Relying Party Requirements

A Relying Party MUST:

1. Key Account records on (`iss`, `sub`), never on `email` or `preferred_username`; the same handle from two Issuers, or from a Relay and its Home Issuer, is two Agents.
2. Store nothing from a token that fails the validation of Section 5.7.
3. Branch on `actor_type` equal to `agent` for policy that applies to agents, such as quotas, feature gates and terms.
4. When `profile` was granted, enforce per-owner limits on (`iss`, `owner_sub`); when `owner_email` was granted, use it for contact and accountability, not as a key.
5. Keep the Access Token for at most its lifetime, use it only at the UserInfo Endpoint, verify that the returned `sub` equals the ID Token's and discard the response otherwise (Section 5.3.2 of [OpenID.Core]), and issue the application's own session with a lifetime chosen by its own policy.
6. Before actions with lasting effect, re-check the Agent at the UserInfo Endpoint within the Access Token lifetime or require a new sign-in; treat `401` `invalid_token` as revocation.
7. Present `access_denied` and `signup_limit_reached` as distinct outcomes, and never render `error_description` without escaping.
8. Not log ID Tokens or Access Tokens, and store Owner data separately from Agent data.
9. Perform discovery only for handles presented to it, and cache results per Section 2.2.
10. To accept Agents from several Issuers, either perform discovery per handle against an allow-list or per-Issuer limits, or configure one Relay (Section 8), but not both a Relay and a Home Issuer it relays, judged by the Relay's current `home_issuers`, since Section 7.6 would then be counted twice.

A Relying Party MUST bind and send a known expected handle as specified in Section 2.5.

## 10. Security Considerations

This specification inherits the security considerations of Section 10 of [RFC6749], Section 5 of [RFC6750], [RFC9700], [RFC6819], Section 16 of [OpenID.Core], [RFC8725], Section 9 of [RFC7033] and [CIMD]. The considerations below are specific to this profile and explain requirements stated in Sections 2 to 9.

### 10.1 Transaction Fixation

An attacker can start a transaction in its own browser and induce an Agent to assert on it, for example by sending it the wait page's identifier; the disclosure names the genuine Relying Party, so the Agent sees nothing wrong. If the attacker's bound session could then follow the continue step, the attacker would hold a Relying Party session as the Agent (compare Section 5.4 of [RFC8628]). Section 6.5 therefore releases the result to the Session Holder only when the assertion carries `deliver_to_session`, which the Agent Client sets only for transactions it started itself (Section 6.3); through a Relay it follows a `follow` step only for a Relay transaction it started, and only to a Home Issuer transaction whose client redirects to the Relay's host ([Relay Profile], Section 4). The transaction identifier is not a credential (Section 6.1), but its holder can read the resource and, absent `login_hint`, complete the transaction with another Agent and deliver that sign-in to the Session Holder; hence the known-handle binding requirement of Section 2.5.

### 10.2 Assertion Replay and Cross-Issuer Use

An assertion is bound to one Issuer by `aud`, to one transaction by `txn`, to one challenge by `nonce`, and to a T_ASSERT window by `exp`; the Issuer consumes the challenge and refuses a second assertion. A captured assertion is therefore useless elsewhere, including at a Relay, whose own `aud` differs from the Home Issuer's.

### 10.3 Key Compromise and Revocation Latency

Revocation stops new sign-ins, voids unredeemed codes and invalidates outstanding Access Tokens at once, but it cannot reach sessions a Relying Party has already issued. The T_TOKEN lifetime bounds the window in which a Relying Party acting on the token alone remains unaware; Section 9 requires a UserInfo re-check before lasting actions. Section 7.2 refuses re-enrollment of a revoked public key so that revocation cannot be undone by re-enrollment, and Section 7.3 ties the invalidation of Delegated Credentials to the Owner's revocation of all keys, since a Delegated Credential held by a compromised Agent would otherwise re-enroll.

### 10.4 Issuer Impersonation and Handle Binding

Section 2.5 prevents a rogue Issuer from claiming another domain's handle, but cannot prove that a trusted Relay contacted the Home Issuer. A direct token without `email` identifies an Agent at the selected Issuer, not a handle. Discovery freshness bounds detection of domain reassignment; neither `sub` nor an unbound callback supplies a missing handle binding.

### 10.5 Mix-up and Redirect Attacks

The `iss` parameter on the redirect [RFC9207], the per-`state` record of the Issuer the request was sent to, and the exact-match rule for `redirect_uri` defend against mix-up and open-redirect attacks; the Issuer never redirects to an unvalidated URI. PKCE applies to Registered Clients as well because a client secret alone does not prevent code injection. Third-party-initiated login (Section 5.8) is accepted only for configured Issuers so that it cannot be used to make a Relying Party fetch attacker URLs.

### 10.6 Open Client Impersonation and Server-Side Request Forgery

An Open Client is trusted only as far as its document URL. Section 4.2 has the Issuer fetch the document under the protections of Section 2.2, and Section 6.1 exposes `client.redirect_host` so the Agent sees who is asking. Owner personal data is withheld from Open Clients because their operator is unverified. The same protections apply to every request a Relying Party or Relay sends to an endpoint learned through discovery, including the Token and UserInfo Endpoints, whose targets are chosen by whoever supplies a handle.

### 10.7 Limits of Owner Attribution

A token proves which Agent signed in and, through the Owner Claims, which verified address stands behind it: attribution and a point of revocation, not an endorsement of the Agent's behaviour or of the Owner's intent. `owner_verified_via` `email` proves only control of an address at the time of verification; Owner approval (Section 6.6) requires an authenticated Owner session because Agents commonly read their Owner's mail.

### 10.8 Sign-up Abuse and Enumeration

Free identities attract automated sign-up farms. Per-owner caps (Section 7.6, whose count includes deleted Accounts and in-flight transactions so that deletion or racing does not free capacity) and Owner verification before an Agent's first sign-in (Section 7.5) are the structural defences; rate limits (Section 6.7) the tactical ones. WebFinger makes handles enumerable by design (Section 2.2). At a Relay accepting any Home Issuer, the cap bounds Agents per (Home Issuer, Owner) only; a party operating its own Issuer is bounded solely by the Relay's per-Home-Issuer policy ([Relay Profile], Section 5).

### 10.9 Algorithm and Key Confusion

Algorithm confusion [RFC8725] is prevented by pinning `alg` to the key type and taking keys only from the JWK Set or the enrolled record (Sections 3.2, 5.7, 6.3, 7.2); the distinct `typ` values keep an assertion from passing as an ID Token and an enrollment proof from passing as an assertion.

### 10.10 Transport, Caching and Clickjacking

The wait, review and Owner approval pages are the pages clickjacking would target, hence `frame-ancestors 'none'` (Section 5.3; Section 4.15 of [RFC9700]); TLS (Section 5) and `no-store` on every response carrying codes, tokens or challenges close the transport and cache channels.

## 11. Privacy Considerations

### 11.1 Owner Personal Data

The Owner's name and address reach only Registered Clients, only for the `owner_profile` and `owner_email` scopes, and only after the disclosure of Section 6.1 listed them. The Owner's authorisation is expressed either as the `share_owner` permission on the key, which only an Owner Credential can grant, or as an approval under Section 6.6. At a Relay the Owner's authorisation covers the Relay and, through it, every Relying Party its published policy admits (Section 11.4).

### 11.2 Correlation across Relying Parties

Public `sub` and `owner_sub` let colluding Relying Parties correlate Agents and Owners. This is a profile choice; per-client caps do not require cross-client identifiers. This version defines no pairwise subjects. Relay subjects also permit correlation by anyone holding the upstream values; their derivation does not include the Relay or downstream client.

### 11.3 Discovery Leakage

The handle's domain names the Owner's operator, and each WebFinger lookup tells that domain which party is asking (hence Section 9 item 9).

### 11.4 Relays

A Relay receives the handle and `owner_sub` upstream even for downstream `openid`-only requests, for binding and local caps. It receives Owner personal Claims only when requested downstream and may forward only granted Claims ([Relay Profile]).

### 11.5 Retention

Consent Records expire after T_CONSENT of non-use. Re-verifying a deleted Owner's address inherits counts only during Section 7.6's published retention period; this deliberately bounds the protection against deletion and re-registration. Address-derived linkage is personal data even when hashed, and recycled mailboxes can inherit counts without inheriting authority. Secret storage, cleanup and restore guidance is informative ([Implementation Guide]).

## 12. Conformance

An **Issuer** MUST meet Sections 2.4, 2.5 and 3 to 7. A **Relying Party** MUST meet Sections 2.2 to 2.5, 4.2, 4.3, 5 and 9. An **Agent Client** MUST meet Sections 2.1 to 2.3, 5.3, 5.8, 6 and 7.1 to 7.2. Each role meets the obligations addressed to it, including applicable security and privacy requirements, whether or not its peers conform. Relay conformance is defined separately in [Relay Profile].

The [conformance checklist](conformance.md) groups observable requirements. A partial or skipped test report does not establish full coverage; lack of a test is not itself a protocol failure. The normative text defines conformance.

## 13. IANA Considerations

Registrations are provisional until this document has a standards-body home; each names this document as its specification document.

### 13.1 JSON Web Token Claims

`actor_type`, `owner_sub`, `owner_name`, `owner_email`, `owner_email_verified`, `owner_verified_via` and `home_iss` (Section 3.1), and `accept_disclosure` and `deliver_to_session` (Section 6.3), in the "JSON Web Token Claims" registry [IANA.JWT.Claims]. The names are not collision-resistant because wire compatibility with a deployed issuer requires them.

### 13.2 OAuth Authorization Server Metadata

`transaction_endpoint`, `agents_endpoint`, `handle_domains`, `home_issuers`, `agent_key_algs_supported` and `agent_login_versions_supported` in the "OAuth Authorization Server Metadata" registry [IANA.OAuth.Parameters] (Section 2.4).

### 13.3 OAuth Dynamic Client Registration Metadata

`max_signups_per_owner`, `require_review` and `relay_issuer` in the "OAuth Dynamic Client Registration Metadata" registry [IANA.OAuth.Parameters] (Section 4.4).

### 13.4 OAuth Extensions Error

`signup_limit_reached`, usage location authorization code grant error response (Section 11.4.1 of [RFC6749]), protocol extension Agent Login, in the "OAuth Extensions Error" registry [IANA.OAuth.Parameters] (Section 5.5). Transaction error codes (Section 6.7) are local to the transaction endpoint, and `insufficient_permission` (Section 7.8) appears only in a JSON body beside `WWW-Authenticate: Bearer error="insufficient_scope"`; neither is registered.

### 13.5 Media Types and Link Relation

`application/agent-login+jwt` and `application/agent-login-enrollment+jwt` per [RFC6838] for the `typ` values of Sections 6.3 and 7.2, and the link relation type `agent-login-transaction` per [RFC8288] (Section 5.3). Registration templates (Section 5.6 of [RFC6838]; Section 2.1.1 of [RFC8288]) will accompany the submission; the media types are intended for the standards tree (Section 3.1 of [RFC6838]).

### 13.6 Underscored DNS Node Name

`_agentlogin`, RR type TXT, in the "Underscored and Globally Scoped DNS Node Names" registry [RFC8552] (Section 2.3).

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
- [RFC1123] Braden, R., Ed., "Requirements for Internet Hosts - Application and Support", STD 3, RFC 1123, October 1989.
- [RFC5890] Klensin, J., "Internationalized Domain Names for Applications (IDNA): Definitions and Document Framework", RFC 5890, August 2010.
- [RFC5321] Klensin, J., "Simple Mail Transfer Protocol", RFC 5321, October 2008.
- [RFC4033] Arends, R., Austein, R., Larson, M., Massey, D. and S. Rose, "DNS Security Introduction and Requirements", RFC 4033, March 2005.
- [RFC4035] Arends, R., Austein, R., Larson, M., Massey, D. and S. Rose, "Protocol Modifications for the DNS Security Extensions", RFC 4035, March 2005.
- [RFC7208] Kitterman, S., "Sender Policy Framework (SPF) for Authorizing Use of Domains in Email, Version 1", RFC 7208, April 2014.
- [RFC8552] Crocker, D., "Scoped Interpretation of DNS Resource Records through \"Underscored\" Naming of Attribute Leaves", BCP 222, RFC 8552, March 2019.
- [RFC6890] Cotton, M., Vegoda, L., Bonica, R., Ed. and B. Haberman, "Special-Purpose IP Address Registries", BCP 153, RFC 6890, April 2013.
- [RFC8190] Bonica, R., Cotton, M., Haberman, B. and L. Vegoda, "Updates to the Special-Purpose IP Address Registries", BCP 153, RFC 8190, June 2017.
- [RFC7515] Jones, M., Bradley, J. and N. Sakimura, "JSON Web Signature (JWS)", RFC 7515, May 2015.
- [RFC7517] Jones, M., "JSON Web Key (JWK)", RFC 7517, May 2015.
- [RFC7518] Jones, M., "JSON Web Algorithms (JWA)", RFC 7518, May 2015.
- [RFC7519] Jones, M., Bradley, J. and N. Sakimura, "JSON Web Token (JWT)", RFC 7519, May 2015.
- [RFC7523] Jones, M., Campbell, B. and C. Mortimore, "JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants", RFC 7523, May 2015.
- [RFC7617] Reschke, J., "The 'Basic' HTTP Authentication Scheme", RFC 7617, September 2015.
- [RFC7638] Jones, M. and N. Sakimura, "JSON Web Key (JWK) Thumbprint", RFC 7638, September 2015.
- [RFC8037] Liusvaara, I., "CFRG Elliptic Curve Diffie-Hellman (ECDH) and Signatures in JSON Object Signing and Encryption (JOSE)", RFC 8037, January 2017.
- [RFC9864] Jones, M. and O. Steele, "Fully-Specified Algorithms for JSON Object Signing and Encryption (JOSE) and CBOR Object Signing and Encryption (COSE)", RFC 9864, October 2025, https://www.rfc-editor.org/rfc/rfc9864.html.
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
- [Relay Profile] Agent Login editors, [Agent Login Relay Profile](relay-profile.md), draft 0.2 proposed, October 2026.
- [Implementation Guide] Agent Login editors, [Implementation Guide](implementation-guide.md), informative, October 2026.
- [AgentID.Interop] Agent Login editors, "AgentID interoperability notes", interop-agentid.md in this repository, October 2026.

## Appendix A. Complete Sign-in over HTTP (Informative)

This appendix follows one sign-in of `scout@example.com` at the Open Client whose `client_id` is `https://client.example.org/client-metadata.json`, performed entirely by an Agent Client that is also the Session Holder.

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
Pragma: no-cache

{"access_token": "...[omitted for brevity]...", "token_type": "Bearer",
 "expires_in": 600, "scope": "openid email profile",
 "id_token": "...[omitted for brevity]..."}
```

The ID Token of Section 3.4, signed by the Issuer key of A.2, is the following JWS; issued to a Registered Client, it differs from this Open Client sign-in in `aud`, `scope` and the Owner Claims:

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

The [AgentID interoperability notes](interop-agentid.md) record observed behavior and documented differences, with dates and test scope. They are informative comparisons, not conformance claims.

## Appendix C. Notices

The text of this specification is licensed under the Creative Commons Attribution 4.0 International licence; code samples are additionally licensed under the Apache License, Version 2.0.
