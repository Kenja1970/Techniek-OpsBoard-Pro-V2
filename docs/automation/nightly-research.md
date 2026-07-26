# Nightly Research Routine - Techniek OpsBoard Pro V2

Techniek OpsBoard Pro V2 can be maintained without a GitHub resource. The routine below is the recommended local process for periodic research-informed improvements.

1. Review current developments in project-management tooling, Kanban/portfolio UX, PMI/PMBOK practice, earned value / earned schedule metrics, Nielsen Norman Group UX guidance, and relevant front-end web technology.
2. Add only approved, traceable changes to the local workspace.
3. Implement and self-verify the change in a local preview.
4. Update `APP_VERSION`, `CHANGELOG.md`, `docs/qa/QA-REPORT.md`, and release archive notes when behavior changes.
5. Run `tests/qa.html` before accepting any change.

Larger ideas such as backend persistence, enterprise authentication, live integrations, hosted AI features, new dependencies, or security-sensitive changes remain backlog items until approved.
