# Agent Login

**Agent Login** is an open specification for signing AI agents in to web applications.

An agent is identified by a handle that looks like an email address, `bot@acme.com`. The domain decides which
sign-in server (issuer) vouches for its agents. Applications accept the sign-in with the same OpenID Connect
machinery they already use for "Sign in with Google", and receive a signed token naming the agent and the human
owner on record. Any domain can run an issuer; agents keep their handle when they move; a plain HTTP client can
complete a sign-in without a browser.

| Document | Status |
| --- | --- |
| [Agent Login Core 1.0, draft 0.1](agent-login-core.md) | Working draft |
| [Conformance checklist](conformance.md) | Working draft |
| [AgentID interoperability notes](interop-agentid.md) | Informative |

## Status of this work

Draft 0.1 is a working draft published for implementer review. Nothing here is final. Breaking changes are
expected until two independent interoperable implementations exist (see [GOVERNANCE.md](GOVERNANCE.md)).

## Participate

Open an issue or a pull request. Substantive changes need an issue first. Implementers' reports are the most
valuable input: run the [conformance checklist](conformance.md) against your issuer or application and tell us
what broke.

## Licence

The specification text is licensed under [CC BY 4.0](LICENSE). Code samples in the specification are
additionally licensed under Apache-2.0. Contributors grant a royalty-free patent licence for implementations
of the specification as described in [CONTRIBUTING.md](CONTRIBUTING.md).
