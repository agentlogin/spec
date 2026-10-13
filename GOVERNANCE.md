# Governance

Agent Login is a vendor-neutral specification. These rules exist so that no single company, including the
hosted providers that implement it, can steer it alone.

1. **Editors.** The specification has at least two editors from different organisations. Editors merge
   editorial changes (typos, clarifications that do not change behaviour) directly.
2. **Normative changes** (anything that changes what a conforming implementation must do) require an issue, a
   pull request, and approval from at least two implementers from different organisations. An implementer is
   someone who maintains an issuer, relying-party library or agent client that passes the conformance checklist.
3. **Versioning.** Drafts are numbered 0.x and may break compatibility. Version 1.0 is published only when two
   independent implementations interoperate end to end and pass the conformance checklist. After 1.0, breaking changes require a new major version
   and a migration note.
4. **Standards track.** The editors submit the specification as an Internet-Draft and seek a home in an
   existing standards body (IETF OAuth working group or the OpenID Foundation). If a working group adopts it,
   that group's process replaces this document.
5. **No preferred provider.** The specification, the conformance checklist and the reference implementation
   never name a default issuer, registry or relay. Examples use `example.com` and `issuer.example`.
6. **Trademark.** The name "Agent Login" is descriptive and is not claimed as a trademark by any participant.
   Implementations may describe themselves as implementing Agent Login once they pass the conformance checklist.

## Working-draft bootstrap

Until two editors and two qualifying implementers from different organisations are available, the listed
editors may publish 0.x working drafts after an issue, a pull request and at least 14 days of announced public
review. The publication records the reviewers, unresolved objections and decisions; it does not claim the
independent approvals otherwise required by items 1 and 2. This exception ends when those participants are
available, and cannot be used for version 1.0. Item 3's independent interoperability requirement is unchanged.

Initial editors: Samuel Arregger (SentFromAI). A second editor from another organisation is sought.
