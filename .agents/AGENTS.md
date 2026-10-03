# CLAUDE.md — Engineering Standards & Operating Contract

> **How to use this file.** Place at repo root. Claude Code loads it automatically into every session in this repo. Anything in `<<ANGLE BRACKETS>>` is a placeholder you must replace before first use — leave one unfilled and Claude will guess, which defeats the purpose. Keep this file under ~500 lines; if it grows past that, split per the "Modular Extension" section at the bottom and reference the children with `@` imports.

---

## 0. Project Facts (fill these in — highest-value section in the file)

| Field | Value |
|---|---|
| Project name | `Techniek OpsBoard Pro V2` |
| Repository | `https://github.com/Kenja1970/Techniek-OpsBoard-Pro-V2` |
| What it does, in one sentence | Local-first enterprise project controls and engineering management system combining PMBOK Earned Value Management (EVM), Lean Kanban flow, multi-type resource capacity forecasting, and grounded procedural AI. |
| Primary users | Project Managers, Department Managers, and Engineering Leads delivering multidisciplinary engineering and construction contracts. |
| Language / runtime | Modern JavaScript (ES2022+), CSS3 with design tokens, HTML5; Cloudflare Workers (Node.js/V8 edge). |
| Package & environment manager | **npm** — standard package manager (`npm install`, `npm test`, `npm run dev`). |
| Dependency source of truth | `package.json` + committed `package-lock.json`. Dev tooling in `devDependencies`. |
| Framework | **Vanilla JS (ES Modules / High-Performance Client DOM) + Cloudflare Workers**, local-first zero-hydration architecture. |
| Datastore | Local-first browser storage (`localStorage` / IndexedDB) with optional Cloudflare Hyperdrive / PostgreSQL edge synchronization. |
| Containerization | Optional Docker / Cloudflare Workers environment. |
| Local dev environment | `npm run dev` (Node HTTP server) or `npx wrangler dev` (Worker emulation). |
| Hosting / deploy target | Cloudflare Pages + Cloudflare Workers with Edge CDN cache. |
| CI | GitHub Actions — invokes `npm run verify` (`node -c` syntax checks, Playwright red-team QA suite, and public asset sync). |
| Public-facing? | **Yes** — §3 (UX), §4 (Core Web Vitals), and §6 (copy) are all active and enforced. |
| Data classification | Internal / client project controls. Zero customer PII beyond user accounts/emails; proprietary pay rates strictly masked in client reporting. |
| Compliance constraints | Section 508 / WCAG 2.2 AA (see §3.3). |
| Agent tooling in use | Claude Code + Antigravity IDE — see §10 for the shared-rules setup |
| Secrets handling | Server environment variables (`OPENROUTER_API_KEY`, `.dev.vars`, `.env.local` gitignored). Never in client localStorage, git commits, or public bundles. |

**Non-goals** — things this project deliberately does *not* do. Claude must not build these without explicit instruction:
- Third-party tracking scripts, advertising trackers, or unvetted analytics.
- Direct client-side storage or transmission of raw LLM API keys.

---

## 1. Operating Contract

You are acting as a senior engineer who is accountable for this code in production six months from now.

**Before writing code:**
1. Read the existing code that surrounds the change. Match its conventions over your own preferences.
2. State your plan in 3–8 bullets and the files you intend to touch. For anything over ~50 lines of diff, wait for approval.
3. If the request is ambiguous in a way that changes the design, ask **one** specific question rather than guessing. If it's ambiguous in a way that doesn't, pick the reversible option and note the assumption inline.

**While writing code:**
4. Smallest diff that fully solves the problem. No drive-by refactors, no unrequested renames, no reformatting untouched lines.
5. Never leave the tree broken between steps. Every commit builds and passes tests.
6. Verify each step before moving to the next. Do not chain three unverified changes.

**Before claiming done:**
7. Run the full gate in §8. Paste actual command output — never assert that tests pass without having run them.
8. Report what you did *not* do, what you assumed, and what you're least confident about. A confident summary that hides a known gap is worse than no summary.

**Hard stops — ask first, always:**
- Schema migrations, data deletions, or anything irreversible in a live environment
- Adding a new dependency (see §7 dependency rule)
- Changing auth, permissions, secrets handling, or payment paths
- Anything touching `<<PROTECTED PATHS, e.g. /infra, /migrations>>`
- Force-push, history rewrite, or branch deletion

**Never:**
- Commit secrets, tokens, `.env` contents, or real customer data — even in tests or fixtures
- Weaken, skip, or `.only`/`.skip` a test to make a build pass
- Fabricate a citation, benchmark number, API signature, or library capability. If unsure, read the source or say you're unsure.
- Add `// TODO` in place of the actual work without flagging it in the summary

---

## 2. Development Style — Karpathy-Inspired Discipline

*(Note: the name is Andrej Karpathy. The principles below are drawn from his published guidance on training neural nets, on "vibe coding," and on keeping AI-assisted work on a short leash.)*

**Simplicity is the default; complexity must be earned.**
- Don't be a hero. Use the boring, well-trodden solution until it demonstrably fails. Novel architecture is a cost, not an achievement.
- The best code is no code. Before adding, ask what can be deleted instead.
- Prefer a slightly repetitive, obvious implementation over a clever abstraction that saves 12 lines. Abstract on the *third* occurrence, not the first.

**Become one with the data.**
- Before optimizing or modeling anything, inspect real inputs and real outputs by hand. Print them. Look at edge cases, nulls, encodings, and the long tail. Most bugs are data bugs wearing a logic costume.
- Never trust a metric you haven't sanity-checked against raw examples.

**Establish a dumb baseline, then improve against it.**
- Ship the simplest end-to-end path that works before adding any sophistication. Measure it. Every later change must beat that number or be reverted.

**Overfit one case first.**
- Make it work correctly for a single concrete input before generalizing. If you can't make one case pass, generalization is premature.

**Tight verification loops.**
- Every change should be verifiable in seconds, not minutes. If the feedback loop is slow, fix the loop first — it pays for itself immediately.
- Fixed seeds, deterministic fixtures, frozen clocks in tests. Non-determinism is a defect, not a quirk.

**Short leash on autonomy.**
- Small diffs, reviewed incrementally. A 600-line generated change that "works" is unreviewable and therefore unshippable.
- Auto-generated code is a draft until a human has read it line by line. Write it so that reading is easy.

**Keep units small enough to hold in one head.**
- Files under ~300 lines, functions under ~50, one clear responsibility each. If a human can't hold the module in working memory, neither can a model, and both will introduce bugs.

**Debug by bisection, not by intuition.**
- Halve the search space with an experiment. Don't "try something" — form a hypothesis, design the smallest test that falsifies it, run it.

---

## 3. Frontend & UX — Nielsen Norman Standards

Applies whenever `Public-facing = yes`.

### 3.1 The 10 usability heuristics — treat each as an acceptance criterion

| # | Heuristic | Concrete requirement in this codebase |
|---|---|---|
| 1 | Visibility of system status | Every async action shows state within 100ms. Skeletons for loads >300ms, progress indicators for >2s (with estimate or step count). No silent operations. |
| 2 | Match system to real world | Copy uses the user's vocabulary, not the schema's. "Notifications," never "webhook config." No internal codenames in UI. |
| 3 | User control and freedom | Every destructive action is undoable or confirmed — prefer undo over confirm. Clear exit from every modal, wizard, and flow. Back button never breaks state. |
| 4 | Consistency and standards | One component per pattern. A concept keeps the same name everywhere: the button that says "Publish" produces a toast that says "Published." Platform conventions over invention. |
| 5 | Error prevention | Constrain input before validating it: correct input types, sensible defaults, disabled-until-valid where honest, format masking. Prevention beats a good error message. |
| 6 | Recognition over recall | Never require the user to remember something from a previous screen. Show, don't make them retrieve. |
| 7 | Flexibility and efficiency | Keyboard shortcuts and bulk actions for repeat users; the novice path stays unobstructed. |
| 8 | Aesthetic and minimalist design | Every element competes for attention. Cut anything that isn't doing a job. One primary action per screen. |
| 9 | Error recovery | Errors state (a) what happened, (b) why, (c) the exact next action — in plain language, in the interface's voice. No error codes without human text. No apologies. |
| 10 | Help and documentation | Contextual, in-place, task-oriented. If a UI needs a manual, fix the UI first. |

### 3.2 Response-time budgets (Nielsen's limits — non-negotiable)
- **≤ 100 ms** — feels instantaneous. All direct manipulation, hover, keypress feedback.
- **≤ 1 s** — flow of thought preserved. Navigation, filtering, in-page transitions. No spinner needed below this.
- **≤ 10 s** — attention limit. Anything approaching this requires a progress indicator with real percentage, and the user must be able to cancel.

### 3.3 Accessibility floor — WCAG 2.2 Level AA, no exceptions
- Contrast: 4.5:1 body text, 3:1 large text (≥18.66px, or ≥14px bold) and UI component boundaries
- Target size ≥ 24×24 CSS px (2.5.8); prefer 44×44 for primary touch targets
- Full keyboard operability; visible focus indicator that is never obscured by sticky headers (2.4.11)
- Semantic HTML first, ARIA only where semantics are genuinely absent
- All non-decorative images have alt text describing function, not appearance; decorative images `alt=""`
- Form inputs have persistent visible labels — placeholder is never a label
- Respect `prefers-reduced-motion` and `prefers-color-scheme`
- Live regions for async status announcements
- Automated: `axe-core` in CI, zero violations. Automated tooling catches ~30–40% of issues — a manual keyboard-only and screen-reader pass is required before any public release.

### 3.4 Design execution
- Mobile-first; verified at 360, 768, 1024, 1440 px
- Type scale, spacing scale, and color tokens defined once in `<<TOKENS FILE>>` — no raw hex, no magic pixel values in components
- Empty states are an invitation to act, never a shrug
- Loading, empty, error, partial, and dense/overflow states are designed for *every* data-driven component. A component without all five is incomplete.

---

## 4. Performance — Core Web Vitals

Field data at the **75th percentile**, segmented mobile and desktop, is the source of truth. Lab data is a proxy for iteration only.

### 4.0 Architecture constraint — read before choosing a frontend

In a Python stack, the Core Web Vitals outcome is mostly decided at framework-selection time, not by later optimization:

- **Server-rendered HTML (FastAPI/Django + Jinja2, progressively enhanced with HTMX or Alpine)** — the default here. HTML arrives complete, so LCP is a network problem rather than a hydration problem, CLS is trivially controlled, and INP stays low because there's almost no main-thread JS. Ships ~15–30 KB of JS total. This is the only option below that hits the §4.2 budgets without a fight.
- **FastAPI backend + separate React/Next frontend** — viable, but you now own two build systems, a hydration budget, and the full JS bundle discipline in §4.2. Take this only if you need genuinely app-like client state.
- **Streamlit / Gradio / Dash** — do **not** use for a public-facing page you intend to pass CWV. They ship large JS payloads, render client-side after a websocket handshake, offer no control over the LCP element or layout reservation, and have known keyboard-navigation and contrast gaps against WCAG 2.2 AA. They're excellent for internal tools and prototypes; they are the wrong tool for §3 and §4.

If you're tempted toward Streamlit for speed of build, the honest tradeoff is that you'd be dropping §3.3 and §4 from this document. Say so explicitly rather than keeping standards you've silently abandoned.

### 4.1 Pass thresholds

| Metric | Good | Needs improvement | Fail | Our target |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | ≤ 2.0 s |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | 200–500 ms | > 500 ms | ≤ 150 ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 | ≤ 0.05 |

Supporting diagnostics: **TTFB** ≤ 800 ms · **FCP** ≤ 1.8 s · **TBT** ≤ 200 ms (lab proxy for INP)

### 4.2 Performance budgets — CI fails on breach
- JS shipped to the browser: ≤ `<<170>>` KB gzipped per route, initial load
- CSS: ≤ 60 KB gzipped · Fonts: ≤ 2 families, ≤ 4 weights, `font-display: swap`, preloaded, subset
- Total initial page weight ≤ 1 MB · Third-party scripts: ≤ `<<3>>`, each individually justified in `docs/third-party.md`
- Lighthouse CI on every PR against a fixed throttled profile: Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95, SEO ≥ 95

### 4.3 Required techniques
- **LCP:** identify the LCP element explicitly; preload it; never lazy-load it. Server-render above-the-fold content. Responsive images with explicit `width`/`height`, modern formats (AVIF/WebP), `fetchpriority="high"` on the hero. Critical CSS inlined. Cache-Control tuned; CDN in front of everything static.
- **INP:** break tasks over 50 ms with `scheduler.yield()` or `isInputPending`. Move heavy work to Web Workers. Debounce input handlers. Avoid synchronous layout thrash in event handlers. Keep hydration payloads small — prefer server components / islands over full-page hydration.
- **CLS:** reserve space for *everything* — images, ads, embeds, banners, async content. Never insert content above existing content after load. Use `font-size-adjust` / `size-adjust` metric overrides to avoid font-swap shift. Transform-based animation only; never animate layout properties.

### 4.4 Monitoring
- RUM via the `web-vitals` library, attribution build, reporting to `<<ANALYTICS SINK>>` — field data beats lab data always
- CrUX / PageSpeed Insights checked on a `<<weekly>>` cadence for the `<<TOP 5>>` routes
- Regression alert if p75 of any metric degrades >10% week-over-week

---

## 5. Backend Rigor — 95%+ Quality Bar

"95% quality" is meaningless as a slogan, so it's decomposed into measurable gates. **All must pass.**

### 5.1 Test gates
| Gate | Threshold |
|---|---|
| Line coverage, whole repo | ≥ 90% |
| Branch coverage, business-logic/domain layer | ≥ 95% |
| Mutation score, `domain/` (`mutmut` or `cosmic-ray`) | ≥ 80% |
| Flaky test rate | 0 tolerated — quarantine and fix within one sprint |
| Critical user journeys with E2E coverage | 100% |

Coverage is a floor, not a goal — mutation score is what proves the tests actually assert something.

**Test shape:** ~70% unit / ~20% integration (real DB via testcontainers, no mocked datastore) / ~10% E2E. Plus property-based tests for parsers, validators, money, dates, and anything with an invariant. Plus a regression test for every bug fixed — the test lands in the same commit as the fix and must fail before the fix.

### 5.2 Reliability & performance SLOs
- Availability: `<<99.9%>>` (≈43 min/month error budget). Ship freeze when the budget is exhausted.
- API latency: p50 ≤ `<<100>>` ms · p95 ≤ `<<300>>` ms · p99 ≤ `<<1000>>` ms
- Error rate: < 0.1% of requests 5xx
- Every DB query in a hot path has an `EXPLAIN` plan reviewed and an index; no N+1 queries — assert query counts in integration tests
- Timeouts, retries with exponential backoff + jitter, and circuit breakers on every external call. No unbounded retries.
- Idempotency keys on all mutating public endpoints
- Graceful degradation: a dependency failing degrades a feature, never the page

### 5.3 Correctness & safety
- `mypy --strict` (config in `pyproject.toml`) passes with zero errors. `Any`, bare `dict`, and untyped `**kwargs` are banned in new code. Every `# type: ignore` carries an error code and a one-line reason — a bare `# type: ignore` fails review.
- Validate at the boundary with Pydantic v2; parse, don't validate — once past the boundary, types are trusted and re-checking is dead code
- Custom exception hierarchy rooted at one project base class. No bare `except:`, no `except Exception` without re-raise or explicit logging, no returning `None` to signal failure
- `ruff` rule set enabled beyond defaults: `E,F,W,I,N,UP,B,A,C4,DTZ,S,SIM,ARG,PTH,RUF` at minimum. `DTZ` matters more than people expect — naive datetimes are a recurring correctness bug.
- All datetimes are timezone-aware UTC internally; convert only at the presentation boundary
- Every mutating operation is transactional and idempotent, or documented as neither with a reason
- Migrations are forward-only, reversible, and tested against a production-shaped dataset

### 5.4 Security — OWASP ASVS Level 2 baseline
- Full OWASP Top 10 review on any auth, input-handling, or data-access change
- Parameterized queries only. Output encoding at render. CSP with nonces, no `unsafe-inline`. HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` set.
- Secrets in a manager, never in code, env files in git, logs, or error messages. Pre-commit secret scanning (gitleaks) required.
- AuthZ checked at the data layer, not just the route. Deny by default.
- Rate limiting on all public endpoints. PII never logged; structured logs redact by allowlist.
- In CI, zero high or critical from all four: `uvx pip-audit` (dependency CVEs) · `uv run bandit -r src` (Python SAST) · `trivy image` (container layers and OS packages) · `gitleaks` (secrets, also as a pre-commit hook)
- SBOM generated per release. Dependencies pinned by `uv.lock`; automated update PRs reviewed weekly.
- Never `pickle` untrusted input. Never `yaml.load` — use `safe_load`. Never `subprocess` with `shell=True` on interpolated input. Never `eval`/`exec` on anything that touched a network.
## 5.4.1 Mandatory Security Standard

Treat security as a first-class acceptance criterion for every application, feature, API, database change, script, configuration, and deployment. Apply production-grade secure engineering by default, even when security requirements are not explicitly stated.

- Use deny-by-default authorization and least privilege. Every protected operation must verify the authenticated actor’s permission on the server at the time of the request.
- Never trust client-supplied roles, ownership, identifiers, prices, permissions, workflow state, or other security-sensitive values.
- Prevent horizontal and vertical privilege escalation. A user must never be able to access another user’s resources or create, assign, promote, impersonate, or modify privileged accounts—including admin, super-admin, owner, system, or “master admin” accounts—unless an independently authorized, server-enforced workflow explicitly permits it.
- Do not rely on hidden UI elements, disabled controls, routes, middleware alone, or client-side validation as security boundaries.
- Secure every entry point, including APIs, background jobs, webhooks, file operations, administrative tools, internal endpoints, and direct object references.
- Validate inputs using strict allowlists and enforce authorization at the object, field, action, and tenant levels. Protect against injection, XSS, CSRF, SSRF, path traversal, unsafe deserialization, mass assignment, broken access control, race conditions, and insecure file handling.
- Use established cryptographic libraries and secure defaults. Never invent cryptography, store plaintext passwords or secrets, expose credentials in code or logs, or weaken TLS and certificate verification.
- Minimize sensitive-data collection and exposure. Encrypt sensitive data where appropriate, redact logs and errors, apply safe retention rules, and keep production secrets out of source control.
- Use secure session and token handling, including appropriate expiration, rotation, revocation, cookie protections, anti-CSRF controls, and resistance to replay, fixation, and account enumeration.
- Apply rate limiting, abuse controls, audit logging, dependency review, and safe failure behavior to security-sensitive functionality.
- Preserve tenant isolation and privilege boundaries in database queries and mutations. Prefer database constraints and transactional enforcement for critical invariants.
- Never add backdoors, universal credentials, undocumented bypasses, insecure development fallbacks, or fail-open behavior.
- Before considering work complete, perform an adversarial review: assume the requester is malicious, authenticated only at the lowest privilege level, and able to modify every client request. Test both expected and forbidden paths, especially authentication, authorization, ownership, role changes, administrative operations, and cross-tenant access.
- When requirements conflict with these controls, identify the security risk clearly and choose the secure implementation. Do not silently trade security for convenience or compatibility.
- Treat any plausible privilege escalation, authentication bypass, secret exposure, cross-tenant access, or destructive unauthorized action as a release blocker. Fix it and add regression coverage before declaring the work complete.

Security must be enforced by architecture and server-side controls—not by assumptions about normal user behavior.

### 5.5 Observability
- Structured JSON logs with correlation/trace IDs propagated end-to-end
- OpenTelemetry traces on all service boundaries; RED metrics (Rate, Errors, Duration) per endpoint
- Health (`/healthz`) and readiness (`/readyz`) endpoints that check real dependencies
- Alerts on SLO burn rate, not on raw metrics — alerts must be actionable or they get deleted

### 5.6 Delivery health (DORA)
Deploy frequency: on-demand · Lead time for change: < 1 day · Change failure rate: < 15% · MTTR: < 1 hour · Every deploy is reversible in one command.

---

## 6. Language, Grammar & Content Quality

Applies to all user-visible copy, error messages, docs, READMEs, commit messages, and API responses. Treat this as a Grammarly-equivalent pass performed before any copy is committed.

### 6.1 Automated
- **Vale** with `<<Microsoft or Google>>` style package + a project vocabulary file — runs in CI on `**/*.{md,mdx,tsx,jsx,html}`, zero errors permitted
- **LanguageTool** or equivalent for grammar/spelling on all `.md` and extracted UI strings
- `cspell` with a committed project dictionary — zero unknown words
- Readability enforced: Flesch Reading Ease ≥ 60 and Flesch-Kincaid grade ≤ 9 for all consumer-facing copy (`<<≤ 12 for technical docs>>`)

### 6.2 Manual pass — check every string against this list
- **Correctness:** spelling, subject-verb agreement, tense consistency, parallel structure in lists, comma splices, dangling modifiers, its/it's, their/there, affect/effect
- **Voice:** active by default. "Save changes," not "Changes will be saved."
- **Tense:** present. "Your file uploads," not "Your file will be uploaded."
- **Person:** second person for the user ("your account"), first person plural sparingly for the company. Never mix within a screen.
- **Case:** sentence case for headings, buttons, labels, and menu items. Title Case only for proper nouns and product names.
- **Punctuation:** no periods on labels, buttons, or single-sentence tooltips. Serial (Oxford) comma. Straight quotes in code, typographic quotes in prose.
- **Numbers:** spell out zero through nine in prose, numerals for 10+; always numerals for data, measurements, and UI values. Locale-aware formatting for dates, currency, and numbers — never hardcode a format.
- **Terminology:** one term per concept, enforced by the Vale vocabulary file. Sign in / sign out (not login/logout as verbs). Delete (not remove) when it's permanent.
- **Concision:** cut "please," "simply," "just," "easily," "in order to," "utilize," "leverage." If a sentence survives deletion of a clause, delete the clause.
- **Inclusivity:** no gendered defaults, no ableist idioms, no "master/slave," "whitelist/blacklist," "sanity check"
- **Truthfulness:** no claim in copy that the product doesn't do. No fake urgency, no dark patterns, no pre-checked consent.
- **Localization-readiness:** no string concatenation to build sentences, no text baked into images, layouts tolerate +35% string expansion

### 6.3 Error message template
> **What happened** (plain, specific) → **Why** (if useful) → **What to do next** (one concrete action).
>
> Good: "That email is already registered. Sign in instead, or use a different address."
> Bad: "Error 422: validation failed." / "Oops! Something went wrong 😔"

---

## 7. Repository Conventions

### 7.1 Commands — Claude uses these, not improvised equivalents
```bash
npm install                        # install project dependencies
npm run dev                        # local dev server
npm test                           # syntax checks + Playwright headless red-team suite (696+ tests)
npm run sync                       # mirror root assets to public/
npm run verify                     # THE GATE: test suite + public sync verification
npx wrangler dev                   # run local Cloudflare Worker environment
```

**Command rules — non-negotiable:**
- Every test execution runs `npm test` (`node scripts/run-qa.mjs`).
- Adding a dependency is `npm install <pkg>` (or `npm install --save-dev <pkg>`).
- `package-lock.json` is committed.
- Claude runs `npm run verify` before declaring anything complete.

### 7.2 Structure
```
app.js / src/   client logic, PMBOK calculations, view renderers, local storage
styles.css      design tokens, theme definitions, component styles
worker/         Cloudflare Worker edge endpoints (auth, db, procedures, assistant)
tests/          QA red-team test suite (qa.html, qa.js, browser verification)
scripts/        run-qa.mjs, sync-public.mjs, dev.mjs
public/         mirrored distribution directory for static hosting
```

**The dependency rule that makes this layout worth having:** `domain/` imports nothing from `adapters/`, `api/`, or `db/`. Dependencies point inward only. Enforce it mechanically with `ruff`'s `flake8-tidy-imports` banned-api rules or `import-linter` in CI — a layering rule that isn't enforced is a layering suggestion.

### 7.3 Naming & style
- PEP 8, enforced by `ruff` (line length `<<100>>`): `snake_case` functions/vars/modules · `PascalCase` classes · `SCREAMING_SNAKE` constants · `_leading_underscore` for private
- Type hints on every public function signature — parameters and return. `-> None` included.
- Prefer `pathlib` over `os.path`, `dataclasses`/Pydantic over dicts-as-records, f-strings over `.format()`, `enum` over string literals for closed sets
- Names say what a thing *is* or *does*, never how it's implemented. No `data`, `info`, `handleStuff`, `utils2`, `temp`.
- Booleans read as assertions: `isLoading`, `hasAccess`, `canPublish`
- Comments explain **why**, never **what**. A comment restating the code is deleted. Non-obvious decisions get a comment; obvious ones don't.

### 7.4 Git
- Conventional Commits: `feat|fix|docs|style|refactor|perf|test|chore|build|ci(scope): imperative subject ≤ 72 chars`
- Body explains why and what changed in behavior; footer links the issue
- One logical change per commit. Branch: `<<type/short-description>>`
- PRs ≤ 400 lines of diff where humanly possible — beyond that, review quality collapses
- Never commit generated artifacts, `node_modules`, `.env`, or IDE config

### 7.5 Dependencies
Adding a dependency requires: a stated reason it beats ~30 lines of local code, a check of maintenance status (last release, open critical issues, bus factor), license compatibility, and transitive-dependency count. **Ask before adding.** Prefer the standard library — `pathlib`, `dataclasses`, `itertools`, `functools`, `datetime`, `zoneinfo`, `tomllib`, `sqlite3`, `concurrent.futures` — over a package. Python's stdlib covers more than most reach for.

Runtime deps and dev deps stay strictly separated (`uv add` vs `uv add --dev`); a dev tool leaking into the production image is a build defect.

### 7.7 Docker
- Multi-stage build. Stage 1 uses the `ghcr.io/astral-sh/uv` image (or installs uv) and runs `uv sync --frozen --no-dev` into `/app/.venv`. Stage 2 is a slim runtime base that copies only the venv and `src/` — no uv, no build toolchain, no test files.
- Set `UV_COMPILE_BYTECODE=1` and `UV_LINK_MODE=copy` in the build stage; copy `pyproject.toml` + `uv.lock` and sync **before** copying source so the dependency layer caches.
- Base images pinned by digest (`python:3.12-slim@sha256:...`), not by floating tag. A rebuild that silently changes the base is not reproducible.
- Runs as a non-root user with a read-only root filesystem where possible. No secrets in `ENV`, in build args, or in any layer — they arrive at runtime.
- `.dockerignore` excludes `.git`, `.venv`, `tests/`, `__pycache__`, `.env*`. A leaked `.venv` in build context breaks caching and can smuggle host artifacts into the image.
- `HEALTHCHECK` defined. Image target: `<<under 300 MB>>`; a size regression >20% fails CI.
- `compose.yaml` pins service versions explicitly and mounts source for hot reload in dev only — the dev compose file and the production image must not diverge in Python version or dependency set.

### 7.6 Documentation
- Every non-obvious architectural choice gets an ADR in `docs/adr/` — context, decision, consequences, alternatives rejected
- README stays runnable: a new engineer clones and reaches a working local environment in under 15 minutes, following only what's written
- Public functions get doc comments stating purpose, params, returns, throws, and one example

---

## 8. Definition of Done — the gate

A change is complete only when **every** box is checked and the evidence has been pasted into the summary.

```
[ ] Requirement restated and confirmed to match what was asked
[ ] Full `verify` script passes — output pasted, not summarized
[ ] New tests written; they fail without the change and pass with it
[ ] Coverage/mutation thresholds still met
[ ] No new lint, type, or Vale errors
[ ] Error paths, empty states, and boundary inputs handled and tested
[ ] Accessibility: keyboard path walked, axe clean, contrast verified   (UI only)
[ ] Core Web Vitals budgets not regressed; bundle delta reported        (UI only)
[ ] Security: no secrets, inputs validated, authZ enforced at data layer
[ ] Copy passed the §6 grammar and style pass
[ ] Docs / ADR / README updated if behavior or setup changed
[ ] Migration is reversible and tested                                  (schema only)
[ ] Observability: new failure modes are logged and traceable
[ ] Rollback plan stated in one sentence
[ ] Assumptions, gaps, and lowest-confidence areas explicitly reported
```

---

## 9. Self-Critique Protocol

After completing work and before presenting it, run one adversarial pass on your own output and report what it found:

1. **What breaks it?** Name three inputs or conditions that would break this. Are they handled or knowingly out of scope?
2. **What did I not test?** State it plainly rather than letting coverage imply completeness.
3. **What would a reviewer object to?** Answer the objection or concede it.
4. **What did I add that wasn't asked for?** Remove it or justify it.
5. **What's the simpler version?** If a materially simpler implementation exists, say so even after writing the complex one.
6. **Is anything I wrote unverified?** Every factual claim about a library, API, or performance number is either verified against source or labeled as an assumption.

If a self-critique finding is real, fix it before presenting — don't present a known defect with a caveat attached.

---

## 10. Modular Extension

When this file exceeds ~500 lines, split and import rather than trimming standards:

```markdown
@docs/standards/frontend.md
@docs/standards/backend.md
@docs/standards/testing.md
@docs/standards/content-style.md
```

Keep §0, §1, §7.1, and §8 in the root `CLAUDE.md` — those are read on every task. The rest can load by reference.

Personal preferences that shouldn't bind the team go in `CLAUDE.local.md` (gitignored). Directory-specific rules go in a `CLAUDE.md` inside that directory.

### Cross-tool setup (Claude Code + Antigravity)

Antigravity does not read `CLAUDE.md`. To avoid maintaining two drifting copies of these standards, make one file canonical and point the others at it:

```
AGENTS.md          ← THE REAL FILE. All content above lives here.
CLAUDE.md          ← one line:  @AGENTS.md
GEMINI.md          ← one line:  @AGENTS.md   (Antigravity-specific overrides only, if any)
.agent/rules/      ← Antigravity workspace rules, for anything Gemini-specific
```

Antigravity reads `AGENTS.md` and `GEMINI.md` at session start and merges them, with `GEMINI.md` winning on conflicts — so keep `GEMINI.md` empty or near-empty unless you have a genuine Antigravity-only rule. Claude Code resolves the `@AGENTS.md` import in `CLAUDE.md`. One source of truth, three entry points.

Two things matter more when the agent is running with the long leash Antigravity's Manager View allows: the **hard stops** in §1 (an agent may make many edits before pausing, so deny rules prevent whole classes of irreversible mistakes) and the **task-decomposition hint** — point the planner at where the spec lives, e.g. "before implementing, read the relevant ADR in `docs/adr/`."

**Maintenance:** when a rule here is violated in review, either the rule was wrong (fix it) or it wasn't enforced (add a CI check). A standard with no automated enforcement decays within a quarter — every numbered threshold in this file should map to a CI gate.
