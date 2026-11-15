---
name: frontend
description: "Builds, styles, and polishes web UI and UX. Use for any frontend, page, component, styling, layout, animation, or visual-quality task, or when asked to make an interface look or feel a certain way."
---

# Frontend

This file is a router over the four rulesets under `references/`, not a rulebook; reading the routed references is the work, not the preamble to it. Before touching any file, name the references the request routes to and the one reason each is needed, then read exactly those. Declaring the set first is what makes the choice reviewable: a reference you never named is one you decided to skip, and a reference you named but never opened is a gap you still owe. Freestyling past the routed set produces the generic AI-slop output this skill exists to prevent. The flow is ground -> brief -> build -> subtract -> verify. The bar is restraint with a visible hierarchy: one primary action, the important thing first, nothing on the screen without a job. A quiet, correct screen that holds its hierarchy at 390 and 1440 in both themes is a finish. Atmosphere, motion, and award-grade surface work are opt-in: build them when the brief asks (a named brand, "premium", "make it stunning", a marketing page), never by default for an internal tool, dashboard, admin screen, report, or figure.

**The bar is not clean-and-correct — it is work a senior designer at Linear, Stripe, or Supabase would ship.** Correct-but-flat is a failure, not a finish. Protect the surface as hard as you protect the build: design is a first-class deliverable, not a one-shot decision you lock and walk away from.

## Phase 0 — Route (before any UI work)

| Request involves… | Read |
|---|---|
| ANY UI implementation, styling, redesign, mockup, or visual decision | `references/design/README.md` FIRST (`DESIGN.md` Gate + React Dev Tooling Gate, then taste/brand routing). |
| Small change on an existing surface (fix, control, restyle, copy/spacing) | Project `DESIGN.md` (or styled sibling) + at most ONE reference (active Layer A skill, or `references/design/redesign-skill.md` for "looks bad"/"improve"); if neither, `references/design/README.md` Phase 0. |
| New screen or flow in an existing project | ALSO `references/design/README.md` Phase 0 (`DESIGN.md` gate + branches) and active Layer A skill. |
| New screen/flow, redesign ("looks bad"/"make it better"), or design-system creation/rework | ALSO `references/design/grounding.md` (step 0). |
| Greenfield with no concrete reference | `references/design/README.md` in full (`_INDEX.md` / `lazyweb.md` / `stylegallery.md` / `image-generator` lanes, one Layer A + one Layer B in full). |
| Concrete visual reference (screenshot, mockup, Figma, Stitch, `image-generator` / imagen, or live URL) | `references/design/image-to-code-skill.md` (static) or `references/design/clone-from-url.md` (live URL); `/visual-qa` reference-fidelity mode. |
| Layout or spatial structure change (app shells, scroll ownership, regions, panels, splits, grids, sticky bars) | ALSO `references/design/layout-skill.md` + `references/design/stylegallery.md` (write `Layout:` line before code for `/visual-qa` A12; stacks on style skill). |
| Paged output (PDF, print stylesheet, headless-Chrome print, HTML deck to paper, page-break defects) | ALSO `references/design/print-paged-media.md` (page box, fragmentation, atomic blocks, keep-together stranding; stacks on style skill). |
| Interaction or motion (micro-interactions, animated components, transitions, gestures, hover/press/state) | ALSO `references/design/interaction-skill.md` (beui.dev curl recipe, adapt to `DESIGN.md` motion tokens; stacks on style skill). |
| Hero atmosphere or ambience (opt-in only: shader/particle/grid background, text reveals, scroll chapters, spotlight/tilt/glare/glowing-border cards) | ALSO `references/design/ambience-skill.md` (react-bits curl recipe + retrofit checklist; never vendor code). |
| Tone outside both anchors (AI-agent UI, charts, landing sections, brutalist/Tailwind-only, or no nearest pattern) | `references/design/component-catalogs.md` (catalog per tone, exploration procedure, licence gate). |
| Writing/modifying frontend code, OR auditing performance / SEO / accessibility / quality | ALSO `references/perfection/README.md`, `references/perfection/craft-floor.md`, and `references/perfection/detect.md` (+ `react-perf-tooling.md` for React): Lighthouse 100 on real Playwright Chromium (never `lighthouse` CLI). |
| Looking up style, palette, font pairing, chart type, landing structure, UX guideline, or keyword design system | `references/ui-ux-db/README.md` + search CLI (lookup tool only; `design` owns taste and `DESIGN.md`). |
| ANY implementation/redesign creating or updating `DESIGN.md`, or operating-layer asks (personas, critique, debt, handoff, synthetic testing) | `references/designpowers/README.md` + `lane-c-review.md` (Phase Final flatness/critique reviewer + `DESIGN.md` accessibility/debt sections; other lanes by phase). |
| Any code change in a React project | `references/design/README.md` Phase 0.5 (grep/install/dev-gate `react-grab`, `react-scan`, `react-doctor`) + `react-dev-tooling-skill.md`. |
| "What do shipped apps in this space look like?"; design-direction research | `references/design/lazyweb.md` (verbatim recipe) + `references/design/_INDEX.md` shortlist. |
| Image only, no code (mockup, app-screen concepts, brand board) | `references/design/imagegen-frontend-web.md` / `references/design/imagegen-frontend-mobile.md` / `references/design/imagegen-brandkit.md` (+ Layer B if named) via `image-generator` subagent. |

**For implementation work, design + perfection load together.** Beauty with a 2 MB bundle fails; Lighthouse 100 that looks like AI slop fails. Both win or neither does.
Full Phase 0 routing table and per-route notes: [references/design/README.md](references/design/README.md)

## Design System and Component Workflow

Choose one branch before UI code changes; `DESIGN.md` is the mandatory implementation contract (all tokens, type, spacing, primitives, motion, responsive rules, accessibility constraints, and accepted debt declared before use, checked via `/visual-qa`, and passed to `gf-qa-behavioral-verification` for significant work):

1. **Concrete visual reference:** extract exact tokens, geometry, copy, spacing, states, and responsive intent into `DESIGN.md` via `references/design/image-to-code-skill.md` (static) or `references/design/clone-from-url.md` (live URL via `getComputedStyle`), build reusable primitives, and run `/visual-qa` reference-fidelity mode.
2. **Greenfield or fresh setup:** run all four research lanes in parallel within budget (`≤4 lanes × 2 waves` default; ask before >2 waves) — Embedded (`_INDEX.md` shortlist, read one Layer A + one Layer B in full; `open-design` if installed; `ui-ux-db` lookups), Lazyweb (`lazyweb.md` verbatim), StyleGallery (`stylegallery.md` + `Layout:` line), and 2–3 `image-generator` drafts (`invoke_subagent({ TypeName: "image-generator", ... })`) — log in `DESIGN.md` `## 0. Research Log`, order content blocks by visitor decision path, never freestyle or copy brand assets, and pass the Primitive Showcase Gate (`references/design/README.md` Phase 0) before product screens.
3. **Existing project with `DESIGN.md` or a component system:** read and follow it, updating `DESIGN.md` before adding any new token, primitive, state, motion rule, accessibility constraint, accepted debt, or reference-fidelity requirement.
4. **Existing project with UI but no `DESIGN.md` and no reusable component layer:** STOP and ask whether to preserve the look with copy-nearby styling or extract `DESIGN.md` plus reusable components first.

Full per-branch workflow and research-lane procedure: [references/design/README.md](references/design/README.md)

## Ruleset 1 — design (`references/design/`)

Load **one Layer A (12 taste skills) + one Layer B (70 brand systems)** after `DESIGN.md` (`README.md` owns routing/stacking/Design QA; `_INDEX.md` maps moods to all 83 files):

- **Hit targets:** touch ≥44×44 pt (44 CSS px), 8–12 pt gap; pointer ≥24×24 CSS px (WCAG 2.5.8) via padding/pseudo-element and continuous bar targets.
- **Hierarchy:** one primary action per brief, top-leading priority content, descriptive title, never destructive or Cancel as Enter default.
- **States:** one fixed control box (`min-width` to longest label, overlay spinner, zero shift) across default/hover/pressed/focus-visible/disabled; data views ship empty, loading, error, offline.
- **Keyboard:** reading-order Tab with uncovered focus rings, Escape closes overlay, Enter runs non-destructive default, shortcuts kept, accessible name + tooltip on icon-only controls.
- **Motion:** cause-driven only on `transform`, `opacity`, `filter`; interruptible, non-blocking, cross-fade under `prefers-reduced-motion`, zero no-op hovers or decorative motion.
- **Icons:** one SVG set only (Lucide, Heroicons, Radix, Phosphor); never an emoji.
- **Browser surfaces:** theme `::selection`, `caret-color`, visible scrollbars, `:focus-visible`, link underline offset, and `tabular-nums` in both themes.
- **Type and spacing floor:** computed heading steps ≥1.25×, heading top ≥1.5× bottom, group gap ≥2× inner gap, desktop measure 65–75 chars, display ≤6rem, tracking ≥-0.04em.
- **Concrete reference = contract:** match pixels, copy, structure, and responsive intent unless deviations are accepted.
- **Never weaken UX to buy points:** never drop animations, hide content, or simplify interactions for scores or deadlines.

Full build rules and craft-floor numbers: [references/perfection/craft-floor.md](references/perfection/craft-floor.md)

### Draft guard: tells kept out of the first draft

- **No one-sided coloured bar or ≥2px accent outline on rounded cards:** forbid `border-left: 4px solid`, `border-l-4`, `::before`/`::after` or inset/gradient stripes, `border: 2px solid var(--primary)`, `ring-2` accent rings, and accent underlines (sweep existing; allow `focus-visible` rings, input validation, neutral 1px rules); use tonal surfaces, ink-alpha washes, accent-ink text, and check glyphs.
- **Lint before visual QA:** run `bun $SKILL_DIR/scripts/perfection/check-draft-guard.ts <changed files or dirs>` on written styles, components, and HTML/reports/figures until exit 0.
- **Detect after the build renders:** run `detectPage({ kind: "url", url }, { reflow: true })` or `bun $SKILL_DIR/scripts/detect/cli.ts --reflow <url-or-html-files>` at 1440 and 390 (`references/perfection/detect.md`), fix errors/warnings before `/visual-qa`, and record advisory decisions.
- **No decorative badge without a state:** pills/chips/tags need a dynamic status, count, or filter category — never static "New", "Pro", or "AI-powered" labels.
- **No stat tile without a decision:** numbers earn tiles only when acted upon; never stack summary tiles above a table with the same figures.
- **No invented proof:** testimonials, quotes, logos, ratings, user counts, and prices come from the project or ship as owner-labelled empty slots.
- **No prop decoration:** forbid tilted devices, floating cards, decorative coordinates, sparkles, and ornaments; previews show real states with readable text.
- **No repeated formula:** never repeat a heading treatment or reuse one image across sections.
- **No subtitle under every heading:** keep a subtitle only where the heading alone would be misread.
- **One fact, one place:** never duplicate a conclusion, figure, or label across banners, callouts, cards, tables, or placeholders.
- **No dated or borrowed surface:** forbid unrequested glass/blur panels, neumorphism, mesh gradients, heavy drop shadows, and 2019 SaaS illustrations; use `DESIGN.md` section 7 surfaces.
- **No generated scaffold:** forbid kickers, icon-tile card grids, giant hero metrics, nested cards, neutral gray text on coloured surfaces, costume monospace, and zero-offset glows unless route-restored.
- **No promotional copy:** delete or rewrite filler ("seamlessly", "effortlessly", "smart", "powerful", "at a glance", "supercharge") into plain factual copy.

Full draft-guard rules and banned-pattern details: [references/perfection/craft-floor.md](references/perfection/craft-floor.md)

## 3. Subtract

- **Delete every element without a user job while keeping all required content:** after `check-draft-guard.ts` exits 0, remove anything the user can act/know without, keep every required-content control/field intact, log removals under "Left out on purpose", move rare secondary actions to menus/objects, and separate groups with whitespace.
- Full subtraction walkthrough: [references/design/README.md](references/design/README.md)

## 4. Verify

- **Bounded `/visual-qa` gate and scoped fixes:** pass `/visual-qa` the brief (B7), `Layout:` line (A12), required-content list (Pass A), and `before` set or reference; scope each fix to one named change and its owned regions, and pass decisions/evidence/debt into `gf-qa-behavioral-verification` for significant work.
- **WCAG 2.2 AA real-browser probe table and grounded gap ledger:** report PASS / FAIL / N/A + evidence for Contrast (1.4.3/1.4.11), Focus (2.4.7/2.4.11), Target size (2.5.8), Keyboard (2.1.1/2.1.2), Reflow/text spacing (1.4.10/1.4.12), Dragging/auth/help/entry (2.5.7/3.3.8/3.2.6/3.3.7), State-stable controls (`getBoundingClientRect()`), and System/surfaces (`DESIGN.md` roles, kit source, no unrequested `backdrop-filter`/neumorphism/mesh gradients); fix every FAIL or log signed-off debt in `DESIGN.md` section 8, and close gap-ledger rows with before/after proof.
- Full WCAG 2.2 AA probe checklist: [references/design/README.md](references/design/README.md)

### Layer 0 — architecture

Create/extract `DESIGN.md` (`design-system-architecture.md`) and enforce 3-Document Separation + Material-First Gate (`products.ts`/`content.ts` + asset templates before UI code, `material-first-workflow.md`): [references/design/_INDEX.md](references/design/_INDEX.md)

### Layer A — taste skills (pick AT MOST ONE style skill; they encode opposing philosophies)

Pick one style skill (`taste-skill.md`, `gpt-tasteskill.md`, `minimalist-skill.md`, `brutalist-skill.md`, `soft-skill.md`, `redesign-skill.md`, `image-to-code-skill.md`, or `imagegen-*.md` via `image-generator`), stacking `output-skill.md`, `stitch-skill.md`, `interaction-skill.md`, or `ambience-skill.md`: [references/design/_INDEX.md](references/design/_INDEX.md)

### Layer B — brand design systems (orthogonal to Layer A; stack freely — `nexu-io/open-design`: https://github.com/nexu-io/open-design)

Load `references/design/<brand>.md` (70 bundled brands) for tokens without copying logos/imagery, or fall back to Layer A mood match / installed `open-design`: [references/design/_INDEX.md](references/design/_INDEX.md)

### React dev tooling

Wire `react-grab`, `react-scan`, and `react-doctor` gated on `NODE_ENV === 'development'`: [references/design/_INDEX.md](references/design/_INDEX.md), [references/design/react-dev-tooling-skill.md](references/design/react-dev-tooling-skill.md)

## Ruleset 2 — perfection (`references/perfection/`)

| File | Read when |
|---|---|
| `README.md` | Writing or auditing frontend code (real-browser audits only, 100-in-all-categories floor, fix-at-architecture, never weaken UX, design-system compliance, report format). |
| `react-perf-tooling.md` | Before ANY React audit (Playwright + `playwright-lighthouse` + `react-scan/lite`, render budgets, React checklist; Lighthouse 100 with 30+ unnecessary renders fails). |

Audit CLI (prod build, mobile + desktop, 3–5 runs median, JSON diagnosis): `uv run $SKILL_DIR/scripts/perfection/lighthouse-audit.py https://localhost:3000`

## Ruleset 3 — ui-ux-db (`references/ui-ux-db/`)

`README.md` documents the search CLI and master-plus-overrides persistence (`product` `style` `typography` `color` `landing` `chart` `ux` `react` `web` `icons` `google-fonts` `prompt`; stacks: `html-tailwind` `react` `nextjs` `vue` `svelte` `astro` `swiftui` `react-native` `flutter` `shadcn` `jetpack-compose`):

```bash
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --design-system -p "Project"
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --domain <domain>
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --stack <stack>
```

## Ruleset 4 — designpowers (`references/designpowers/`)

`README.md` routes the pinned `Owl-Listener/designpowers` corpus (personas, accessibility/cognitive constraints, critique, debt, handoff, synthetic testing, motion, role prompts) into `DESIGN.md` first as the implementation contract; it replaces nothing.

## Quick routes — most common requests

Full quick-route lookup table: [references/design/README.md](references/design/README.md)

## Shared axioms (all four rulesets agree — apply always)

- **No design system = no UI work:** `DESIGN.md` exists before components; colors, font sizes, and spacing trace to its tokens.
- **Material-First before screens:** separate Purpose, UX & Data Flow (`products.ts`/`content.ts`), and Visual Direction (`DESIGN.md` + asset templates) per `references/design/material-first-workflow.md` before assembly.
- **Concrete reference = contract:** match reference pixels, copy, structure, and responsive intent unless deviations are accepted.
- **Never weaken UX OR flatten the surface to buy points:** hit Lighthouse 100 AND keep dimensional/lit material — never drop animations, hide content, or flatten surfaces.
- **No emojis as icons:** SVG icon sets only (Lucide, Heroicons, Radix, Phosphor).
- **No coloured accent borders on rounded surfaces:** forbid `border-l-2 border-primary` or `border-{side}-{primary|warning|destructive|success}` (sweep existing; only `focus-visible` rings allowed); use ink-alpha washes, check glyphs, and tonal layering.
- **GPU-composited animation only:** animate `transform`, `opacity`, and `filter` only; never animate layout properties.
- **Slop animation is forbidden — motion serves meaning:** every animation/hover maps to a real interaction, state change, or affordance.
- **Done is the `/visual-qa` dual-oracle gate, not your own glance:** run `/visual-qa` in a real browser at 375 / 768 / 1280px (375px first) until the gate passes on fresh evidence.
- **Copy density cap:** max one headline (≤12 words / ≤20 CJK chars) + one supporting line (≤24 words / ≤60 CJK chars) per hero/card, and ≤3 bullets of ≤12 words per section.
- **No fabricated numbers on the surface:** source all stats, benchmarks, testimonials, and pricing from the brief/data or render `—`.
- **Write in ≤100-line chunks and reopen the file:** scaffold first, write/edit in chunks via `write_file` / `edit_file` (<250 lines / <24KB), and re-read with `read_file`.
- Full shared-axioms rationale and examples: [references/perfection/craft-floor.md](references/perfection/craft-floor.md)

## When to load something else instead

| Situation | Load |
|---|---|
| Brand/style not among the 70 in `references/design/`, or the user says "Open Design" | `open-design` skill — the nexu-io/open-design library (https://github.com/nexu-io/open-design; 137+ design skills, 150+ design systems) — **only if installed in this session; it is not bundled in this plugin**. Otherwise design from the closest Layer A/B match. |
| Driving a browser for the Design QA phase or captures | `visual-qa` skill — drives the connected Antigravity browser MCP (renders, screenshots, signed-in pages) |
| Pure TypeScript/logic work with zero visual surface | `programming` skill alone — this skill adds nothing there |

## Activation

Use for any frontend, web UI, UX, visual, design, styling, layout, animation, performance, accessibility, or SEO work — building, redesigning, auditing, or generating mockups. Not for backend, CLI, or pure-logic tasks with no visual surface.
