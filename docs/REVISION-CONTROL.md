# Revision Control - Techniek OpsBoard Pro V2

Techniek OpsBoard Pro V2 does not require GitHub to maintain revision control. GitHub can be used later as a remote mirror or CI host, but it is not the source of truth for this local-first MVP.

## Local Baseline

Project folder:
`C:\Users\gbrown\Documents\Projects\Techniek-OpsBoard-Control-Center`

Recommended release archive pattern:

```powershell
Compress-Archive -Path .\* -DestinationPath "..\Techniek-OpsBoard-Control-Center-v3.0.0.zip"
```

Each release should include:

- `APP_VERSION` and schema version in `app.js`.
- `CHANGELOG.md` entry.
- `docs/qa/QA-REPORT.md` with latest QA count.
- Dated archive package.
- Requirement traceability notes when requirements change.

When local Git is available, use short-lived branches, local commits, and tags in addition to the archive package.
