# Working draft 0.2 publication record

Date: 24 October 2026. This record accompanies the editor-authorized working-draft
release; it is not approval of final version 1.0 or certification of an implementation.

## Source and public process

The normative baseline is commit `a000e29c7af91d3fd8a5a4ad6241e2b10aabcc78`.
Publication changes the status, date and review documentation only. The release tag
identifies the complete published revision; deployments should pin that revision.

Public discussion is recorded in [issue 1](https://github.com/agentlogin/spec/issues/1)
and [pull request 2](https://github.com/agentlogin/spec/pull/2). Review remains open
after publication. The listed editor, Samuel Arregger (SentFromAI), authorized the
launch preparation and working-draft publication. The limited bootstrap in
[Governance](GOVERNANCE.md#working-draft-bootstrap) applies: no fixed waiting period,
and no claim of the independent approvals otherwise required for normative changes.

## Review and decisions

The editor's Codex-assisted process reviewed protocol dependencies, lifecycle and
concurrency behavior, checklist consistency, reduction of normative text and
implementation feedback. Codex reviewers acted for the same project; they are AI
reviewers, not separate organisations or qualifying independent implementers.
The changelog records the protocol corrections made before the baseline above.

For publication, the primary Codex reviewer checked the source/status diff and ran
the read-only document checker. Codex `beta_first_onboarding` (AI, same project)
separately checked the publication claims and compatibility with the bootstrap,
and compared the normative bodies with the baseline. These reviews do not constitute an
external security audit. No external implementer approval is recorded by this release.

The decisions are to publish the concise Core and checklist as working draft 0.2,
keep the Relay profile separate, and retain storage, retry, restore and operational
techniques as informative guidance. The checker verifies 98 checklist groups,
section references, local links, printed claims, two ES256 signatures, a thumbprint
and the PKCE example; it does not prove implementation conformance.

## Unresolved limitations

- A second editor and qualifying implementers from different organisations are
  still sought. Independent end-to-end interoperability remains required for 1.0.
- Implementation tests and the SentFrom pilot cover specific configurations, not
  every checklist obligation, optional Relay feature or provider integration.
- Product launch acceptance, fresh human onboarding, operational alert delivery
  and an outside developer's integration are separate from publishing this draft.
- AgentID remains a different protocol. The informative mapping is not a claim
  that AgentID services implement Agent Login Core.

No external comments were recorded in the issue, PR discussion, reviews or inline
comments at the 24 October publication review. Review remains open. No external
objection has been adjudicated as resolved by an automated review.
New objections and implementation results belong in the public issue/PR;
they can require a later working-draft correction. This release does not waive any
independent interoperability or governance requirement for final version 1.0.
