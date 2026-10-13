# Agent Login

**Agent Login** is an open specification for signing AI agents in to web applications.

An agent is identified by a handle that looks like an email address, `bot@acme.com`. The domain decides which
sign-in server (issuer) vouches for its agents. Applications accept the sign-in with the same OpenID Connect
machinery they already use for "Sign in with Google", and receive a signed token naming the agent and the human
owner on record. Any domain can run an issuer; a domain can change its issuer while retaining its handles;
a plain HTTP client can complete a sign-in without a browser. Changing issuer changes the application's
`(iss, sub)` identity: transferring existing application accounts is outside this specification.

| Document | Status |
| --- | --- |
| [Agent Login Core 1.0, draft 0.2 proposal](agent-login-core.md) | Proposed; not approved for publication |
| [Conformance checklist](conformance.md) | Working draft |
| [Relay profile](relay-profile.md) | Proposed companion specification |
| [Implementation guide](implementation-guide.md) | Informative |
| [Draft 0.2 migration notes](migration-0.2.md) | Proposed compatibility changes |
| [AgentID interoperability notes](interop-agentid.md) | Informative |

## Reference implementation

[agentlogin/reference](https://github.com/agentlogin/reference) (Apache-2.0) accompanies this work: an issuer, a
conformance harness that exercises part of the checklist, an agent client and command line, a relying-party
kit, and an example application. Its unit tests, storage adapters and harness results are useful evidence;
they do not establish complete protocol conformance or independent interoperability.

## Status of this work

Draft 0.1 remains the published baseline in Git history. The files in this revision prepare draft 0.2 for review;
they do not assert that the editors or independent implementers have approved it. Nothing here is final.
Breaking changes are expected until two independent interoperable implementations exist (see
[GOVERNANCE.md](GOVERNANCE.md)). The working-draft bootstrap process does not waive the independent
interoperability requirement for 1.0.

## Check the specification

With Node.js 22 or later, run `node scripts/check-spec.mjs`. It checks checklist section references, local
links and the printed signatures, claims, thumbprint and PKCE example. It writes no files and certifies no
implementation. Review behavioral changes against the [checklist](conformance.md); storage and fault-injection
techniques are in the [informative guide](implementation-guide.md).

## Participate

Open an issue or a pull request. Substantive changes need an issue first. Implementers' reports are the most
valuable input: run the [conformance checklist](conformance.md) against your issuer or application and tell us
what broke.

## Licence

The specification text is licensed under [CC BY 4.0](LICENSE). Code samples in the specification are
additionally licensed under Apache-2.0. Contributors grant a royalty-free patent licence for implementations
of the specification as described in [CONTRIBUTING.md](CONTRIBUTING.md).
