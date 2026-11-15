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
| ANY UI implementation, styling, redesign, mockup, or visual decision | `references/design/README.md` FIRST. It enforces two mandatory gates — the Design System Gate (a `DESIGN.md` must exist before any component is written) and the React Dev Tooling Gate (react-grab / react-scan / react-doctor installed by default) — then routes to the taste and brand references below. |
| Small change on an existing surface: a fix, a new control, a restyled component, a copy or spacing change | The project's `DESIGN.md` (or the nearest styled sibling when there is none) plus at most ONE design reference: the Layer A style skill the project follows, or `references/design/redesign-skill.md` when the ask is "this looks bad" / "improve this". No `DESIGN.md` and no styled sibling either: `references/design/README.md` Phase 0 (it asks). |
| A new screen or flow in an existing project | ALSO `references/design/README.md` Phase 0 (the `DESIGN.md` gate and its branches) and the Layer A skill in use. |
| A new screen or flow, a redesign ("this looks bad", "make it better"), or design-system creation or rework | ALSO `references/design/grounding.md` (step 0 below). |
| Greenfield with no concrete reference | `references/design/README.md` in full: the gate, the greenfield research lanes (`_INDEX.md` shortlist, `lazyweb.md`, `stylegallery.md`, `image-generator` / imagen drafts), and the style routing. One Layer A + one Layer B, read in full. |
| A concrete visual reference: screenshot, mockup, Figma export, Stitch or `image-generator` / imagen output | `references/design/image-to-code-skill.md`; a live site or URL to clone: `references/design/clone-from-url.md`. The reference is the contract and `/visual-qa` runs in reference-fidelity mode. |
| Any layout or spatial structure change: app shells, scroll ownership, a new or reshaped region, shell, panel, split, list or grid, sticky bar, or scroll container; "what goes where"; "this layout breaks at X" | ALSO `references/design/layout-skill.md` for the mechanics, then `references/design/stylegallery.md` to fetch a named pattern contract for that exact spatial problem. Write the `Layout:` line (Brief, below) before the code; `/visual-qa` A12 checks the build against it. Both stack on the style skill and add no visual direction. |
| Paged output — a PDF report, a print stylesheet, a headless-Chrome print pipeline, an HTML deck printed to paper, or any "why is this page half empty" break defect | ALSO `references/design/print-paged-media.md` for the page box, the fragmentation properties, the atomic-block set, and the keep-together side effect that strands a block on a near-empty page. It adds no visual direction and stacks on the routed style skill. |
| Interaction or motion work — micro-interactions, animated components, transitions, gestures, hover/press/state feedback, "make it feel alive" | ALSO `references/design/interaction-skill.md`. The beui.dev catalog is the mandatory interaction reference: find the nearest pattern, read its real source through the file's curl recipe, and adapt the mechanism to `DESIGN.md` motion tokens. It stacks on the routed style skill — never replaces it. |
| Hero atmosphere or ambience (only when the brief asks) — an animated, shader, particle, or grid background; a typographic reveal (split, blur, shimmer, typewriter, count-up, marquee); scroll storytelling; spotlight / tilt / glare / glowing-border card surfaces; "make the hero stunning", "add a living background", "animate the headline" | ALSO `references/design/ambience-skill.md`. The react-bits catalog is the mandatory ambience reference: find the nearest pattern in its intent map, read its real source through the file's curl recipe, extract the mechanism, and run its retrofit checklist (reduced motion, off-screen pause, compositor-only, tokens, budget) before shipping. It stacks on the routed style skill — never replaces it, and never vendors react-bits code. |
| Tone outside both anchors: AI-agent UI, charts, landing sections, a brutalist or Tailwind-only build, or no nearest pattern | `references/design/component-catalogs.md`: which catalog per tone, the exploration procedure, the licence gate. |
| Writing or modifying frontend code, OR auditing performance / SEO / accessibility / quality | ALSO `references/perfection/README.md`, `references/perfection/craft-floor.md`, and `references/perfection/detect.md` (+ `react-perf-tooling.md` before any React audit). Lighthouse 100 in every category, measured on real Playwright Chromium (never the `lighthouse` CLI), won in the architecture — never by dropping animations or hiding content. Design and perfection load together for implementation work. |
| Looking up a concrete style, palette, font pairing, chart type, landing structure, or UX guideline — or generating a design system from keywords (or a greenfield palette/type/chart/landing-structure question) | `references/ui-ux-db/README.md` and its search CLI (library, below). A searchable CSV database with a CLI: a lookup tool, never the posture (`design` stays the source of truth for taste and the `DESIGN.md` contract). |
| ANY implementation or redesign that creates or updates `DESIGN.md` — plus explicit operating-layer asks (personas, critique, debt, handoff, synthetic user testing) | `references/designpowers/README.md` + `lane-c-review.md`. `lane-c` is the Phase Final flatness/critique reviewer and fills the accessibility-constraint and accepted-debt sections `DESIGN.md` requires. Load other lanes only when their phase applies. |
| Any code change in a React project | `references/design/README.md` Phase 0.5: the react-grab / react-scan / react-doctor check (a grep), the install when one is missing, and the dev-only gate; `react-dev-tooling-skill.md` for per-framework snippets. |
| "What do shipped apps in this space look like?"; design-direction research for an existing product | `references/design/lazyweb.md` (run its recipe verbatim) + the `references/design/_INDEX.md` shortlist. |
| Image only, no code: a mockup, app-screen concepts, a brand board | `references/design/imagegen-frontend-web.md` / `references/design/imagegen-frontend-mobile.md` / `references/design/imagegen-brandkit.md` (+ a Layer B brand if named) via the `image-generator` subagent. These never write code. |

**For implementation work, design + perfection load together.** Beauty with a 2 MB bundle fails; Lighthouse 100 that looks like AI slop fails. Both win or neither does.

## Design System and Component Workflow

Every implementation must choose one of these branches before UI code changes:

1. **Concrete visual reference:** the user supplied a reference — treat it as the visual contract, then handle it by kind:
   - **Static visual reference** (screenshot, generated mockup, Stitch / `image-generator` output, Figma export, overview, or annotated packet): load `references/design/image-to-code-skill.md` plus the relevant design/perfection files, extract the reference's exact tokens, layout geometry, copy, spacing, states, and responsive intent into `DESIGN.md`, then implement reusable primitives against that contract.
   - **Live site or URL reference** (the user names a site to clone or gives a URL): load `references/design/clone-from-url.md`. Drive a real browser and extract the runtime truth via `getComputedStyle` — tokens, layout geometry, default/hover/focus/active states, transitions and keyframes, and downloaded assets — into `DESIGN.md`, then clone-code reusable primitives against that contract.
   Final QA for both runs `/visual-qa` in reference-fidelity mode: compare the actual UI against the reference pixel-by-pixel and verify the code is an extensible design-system implementation, not a screenshot-matched one-off.
2. **Greenfield or fresh setup:** if the user gave no concrete visual reference, design research is a build step with named deliverables — not optional context to skip. Do not cut these build lanes short on a hunch ("enough exploration"), while keeping total subagent fan-out within the session budget (`≤4 lanes × 2 waves` by default; ask the user before exceeding 2 waves). Fire every research lane IN PARALLEL before `DESIGN.md` is written, and open `DESIGN.md` with a `## 0. Research Log` section recording each lane's deliverable — a lane with no Research Log line did not run. Skip a lane only when its tool or network is genuinely unavailable, and name the skip in `DESIGN.md`:
   - **Embedded references:** use `references/design/_INDEX.md` to shortlist 2-3 plausible Layer B references, then read exactly one Layer A style skill and one Layer B reference in full — every line, no partial reads (they are 200-500 lines; a sliced read produces the flattened token set this gate exists to prevent). Log the shortlist, the pick, and why. The `open-design` skill is an external library not bundled in this plugin — use it only if it is actually installed in the session; otherwise the curated set IS the ceiling and you design from the closest Layer A/B match. Add `ui-ux-db` lookups for palette/type/domain questions.
   - **Lazyweb real-product screens:** READ `references/design/lazyweb.md` FIRST and run its recipe verbatim — do not improvise curl calls against lazyweb.com; the recipe mints its own anonymous token. Log the queries run, how many screens you actually VIEWED, and the layout grammar harvested — never pixel copies.
   - **StyleGallery spatial patterns:** read `references/design/stylegallery.md` and fetch the pattern whose primary spatial problem matches the screen. Log the pattern adopted and the element that owns the scroll.
   - **Concept drafts (`image-generator` subagent):** generate 2-3 concept drafts via the `image-generator` subagent (`invoke_subagent({ TypeName: "image-generator", ... })`), each seeded with the loaded Layer A + Layer B tokens (palette, type, material); pick the strongest and treat the chosen draft as the reference-fidelity contract. Log the draft paths and the pick.
   Synthesize every lane into `DESIGN.md`. Treat sources as source material, not mood labels: extract tokens, layout grammar, component anatomy, interaction states, motion, and taste decisions, then recombine them into project-specific primitives. Before laying out sections, inventory the content blocks and assign each a job — hook, explain, prove, compare, convert, navigate, retain — then order sections by the visitor's decision path, not by visual symmetry. Never freestyle past the selected references, never copy logos or brand-specific copy. Then run the Primitive Showcase Gate (`references/design/README.md` Phase 0) before any product screen.
3. **Existing project with `DESIGN.md` or a component system:** read it, follow it, and update it before implementation only when the requested work needs a new token, primitive, state, motion rule, accessibility constraint, accepted debt, or reference-fidelity requirement.
4. **Existing project with UI but no `DESIGN.md` and no reusable component layer:** STOP and ask the user one focused question: should you preserve the current look with copy-nearby styling, or extract a real `DESIGN.md` plus reusable components before continuing? Do not silently choose.

The resulting `DESIGN.md` is the implementation contract: tokens, typography, spacing, primitives, motion, responsive behavior, accessibility constraints, and accepted debt must be named there before code uses them. Verify component primitives, states, and final screens with real visual QA evidence; pass design-system decisions, implementation evidence, and unresolved debt into `gf-qa-behavioral-verification` for significant implementation work.

## Ruleset 1 — design (`references/design/`)

The reference library has one architecture file, 12 taste skills (Layer A — *how to execute*), and 70 brand design systems (Layer B — *what it should look like*). Most non-trivial tasks load **one Layer A + one Layer B**. `README.md` carries the full routing flow, stacking rules, anti-patterns, and the mandatory browser-based Design QA phase; `_INDEX.md` catalogs all 83 files with mood-to-brand mappings — read it whenever routing is not obvious from the tables below.

- **Hit targets.** Touch layouts: at least 44x44 pt (44 CSS px) per interactive element, 8-12 pt between neighbours. Pointer-only: at least 24x24 CSS px (WCAG 2.5.8), about 10 px beyond the glyph. Grow the hit area with padding or a pseudo-element, never the glyph; adjacent bar buttons share continuous hit areas.
- **Hierarchy.** The brief's primary action is the one prominent control; the most important content sits top-leading in reading order; each screen's title says what it is; neither a destructive action nor Cancel is the Enter default.
- **States.** A control ships with hover, pressed, focus-visible, and disabled states beside its default. It keeps one box in every state: the label, icon, and spinner swap inside slots that exist in all states (a min-width sized to the longest label, a spinner overlaying the hidden label), so width, height, and padding never change when the state does, and an arrow or spinner never adds padding when it appears. A data view ships empty (offering the next action), loading (a placeholder at once, a spinner only past about a second), error (cause beside the object), and offline.
- **Keyboard.** Every action reachable in reading order with a visible focus ring that no sticky bar or overlay covers; Escape closes the topmost overlay; Enter triggers the non-destructive default; standard shortcuts keep their meaning; icon-only controls carry an accessible name and a tooltip.
- **Motion.** Only for a cause (an interaction, a state change, an arrival), on `transform`, `opacity`, `filter`; interruptible, never gating input; movement becomes a cross-fade under `prefers-reduced-motion`. A hover that changes nothing or motion on a non-interactive element is slop: leave it out.
- **Icons.** One SVG set (Lucide, Heroicons, Radix, Phosphor); never an emoji.
- **Browser surfaces.** Text selection, the caret, visible scrollbars, the focus ring, link underline offset, and tabular numerals are themed from the palette in both themes; none ships as the browser default. `references/perfection/craft-floor.md` has the property for each.
- **Type and spacing floor.** Each heading step (display to h3, and the smallest heading to body) differs by at least 1.25x, and body-family roles that sit closer also differ by weight, colour or case; the space above a section heading is at least 1.5x the space below it; the gap between groups is at least 2x the gap inside one; body text runs 65-75 characters per line on desktop; display type stays at or under 6rem and tracking at or above -0.04em unless the chosen style route sets its own. Check computed values, not the source.
- **Concrete reference = contract.** Match its pixels, copy, component structure, and responsive intent unless the user accepts a deviation.
- **Never weaken UX to buy points.** No dropping animations, hiding content, or simplifying interactions for a Lighthouse score or a deadline.

### Draft guard: tells kept out of the first draft

Some tells regenerate by default, so they are kept out of the first draft rather than left for QA to find.

- **No coloured bar on one side of a box, rounded or square, and no accent outline on a rounded card, decorative or state.** A card, callout, warning, cover block, stat tile, testimonial, alert, or list row never carries a coloured stripe on one side: `border-left: 4px solid <accent>` or `border-l-4 border-indigo-500`, a coloured `::before`/`::after` bar inside it, an inset `box-shadow` stripe, or a hard-stop gradient band or gradient `border-image` along one edge. A rounded card never wears a 2px-or-wider accent outline either (`border: 2px solid var(--primary)`, `ring-2 ring-indigo-500`, an inset ring). Both read as generated whether they decorate the box or mark it selected, focused, or active, and an accent underline under a heading, tab, or link counts too: use a neutral 1px rule, or set the text itself in the accent ink. Give the card its identity another way: a tonal surface (one ink at a low alpha, or the next step of the surface ramp), a heading set in the accent ink, a leading glyph, or more space between groups. Encode state with one ink at many alphas (hover/selected/active washes), a check glyph for selection, and tonal layering for focus. The coloured edges that stay allowed: keyboard `focus-visible` rings, validation states on form inputs, neutral 1px hairlines and dividers between rows or sections, table rules, and a blockquote's neutral rule. This covers pre-existing instances on any surface you touch.
- **Lint before visual QA.** Run `bun $SKILL_DIR/scripts/perfection/check-draft-guard.ts <changed files or dirs>` on every stylesheet, component, and HTML file you wrote, including a report or figure you will print, screenshot, or render to an image. It reads CSS/SCSS/Less, HTML, JSX/TSX, Vue, Svelte, Astro, Tailwind classes (including `@apply` and `cva`/`cn` strings), inline styles, and styled-components, and flags the stripes above plus promotional filler copy, emoji used as icons, hype badges, and hard-coded vanity numbers in stat tiles. Exit 1 means a tell is in the draft: remove it, do not argue with the finding.
- **Detect after the build renders.** Once the page renders, run the detect SDK on it at 1440 and 390 with reflow on (`references/perfection/detect.md`): `detectPage({ kind: "url", url }, { reflow: true })` from code, or `bun $SKILL_DIR/scripts/detect/cli.ts --reflow <url-or-html-files>`. It reads the rendered page (contrast on the painted background, type scale, heading order, overflow, decoration and copy tells). Fix every error and warning before `/visual-qa`; record a decision for each advisory.
- **No decorative badge without a state behind it.** A pill, chip, or tag appears only when it carries a value that can change: a status, a count, a category the user filters by. "New", "Pro", or "AI-powered" on a static heading is decoration.
- **No stat tile without a decision behind it.** A number earns a tile when someone acts on it; four tiles above a table that already holds the numbers are filler.
- **No invented proof.** Testimonials, quotes, customer logos, ratings, user counts, and prices come from the project or stay out. A section that needs proof the project does not have is cut, or ships as an empty slot labelled for the owner to fill; a "sample" testimonial is still a fabricated one.
- **No prop decoration.** A device tilted for effect, a floating reassurance card, decorative coordinates, sparkles, and ornaments that say nothing about the product are the generated version of "premium". A product preview shows a real state of the product, with its text readable at the rendered size.
- **No repeated formula.** A treatment that carries one heading (a serif line with an italic accent phrase, a gradient word, a headline-subtitle pair) becomes a template when every section repeats it; so does one image reused across sections. Use each once, where it means something.
- **No subtitle under every heading.** A heading explains itself; a one-line description under each one is the generated rhythm. Keep a subtitle only where the heading alone would be misread.
- **One fact, one place.** A conclusion banner and a callout that restates it, a summary card and a table row with the same figure, a label repeated as its placeholder: keep one.
- **No dated or borrowed surface.** Glass and blur panels (they read as a clone of a popular open-source chat app), neumorphism, mesh-gradient heroes, heavy drop shadows, and 2019-era SaaS illustration date a draft on sight. Surfaces come from `DESIGN.md` section 7; a material ships only when the brief or a concrete reference supplies it.
- **No generated scaffold.** No kicker label above a heading, no icon tile stacked over a heading in a grid of same-size cards, no hero metric (a giant number with a small label and supporting stats), no card inside a card, no neutral gray text on a coloured surface, no monospace as a "technical" costume, and no zero-offset coloured glow standing in for a shadow. `references/perfection/craft-floor.md` gives the replacement for each, and says when the brief or its chosen route brings one back.
- **No promotional copy.** Interface copy states what a thing is or does. "Seamlessly", "effortlessly", "smart", "powerful", "at a glance", "supercharge", and their Korean counterparts ("한눈에", "손쉽게", "스마트한", "효율적으로", "간편하게") are marketing, not interface: rewrite as the plain fact or delete.

## 3. Subtract

After the draft renders and the lint exits 0, walk every element on the screen and ask what the user could not do or know without it. No answer: delete it, whatever the reference or the previous version showed. Then open the brief's required-content list and confirm every item is still on the screen by name, with its own control or field. Subtraction that merges two required inputs into one, drops a datum, or shortens required copy is a regression, not a cleanup. Record what you removed under "Left out on purpose". Then count the controls: a secondary action most visits do not need moves into a menu or to the object it acts on, and groups separate by whitespace, not by boxes and borders. Fewer controls with room around them is the target.

## 4. Verify

Done is the `/visual-qa` gate, not your own glance. It owns the visual checks; this skill keeps build rules. Hand it the brief (B7 checks the primary action and priorities), the `Layout:` line (A12), the required-content list (Pass A), and, for a changed surface, the `before` set so it runs Before/after mode and the pair shows what improved. Its review loop is bounded (its Step 4 sets the budget): defects earn another round, and taste findings are recorded and stop it. A concrete reference runs reference-fidelity mode. Fix passes are scoped: after the first build, each fix names one change and the regions it owns (a token fix may own every region) and leaves everything else untouched, because a whole-page "make it better" pass breaks what was already right. Pass design-system decisions, evidence, and unresolved debt into `gf-qa-behavioral-verification` for significant work.

Every UI or design-system deliverable states its WCAG 2.2 AA result. Probe the built surface in the real browser and put a table in the deliverable (PR body, change description, or reply): one row per item below, PASS / FAIL / N/A, with its evidence. A FAIL is fixed, or recorded as accepted debt in `DESIGN.md` section 8 with the user's sign-off.

- **Contrast** (1.4.3, 1.4.11): text 4.5:1 (large 3:1), icons and control edges 3:1, both themes, placeholder text included.
- **Focus** (2.4.7, 2.4.11): Tab through every control and screenshot each ring; none missing, none entirely hidden by a sticky bar or overlay (the AA line; the target is none covered at all).
- **Target size** (2.5.8): every pointer target at least 24x24 CSS px, or an undersized one whose 24 px circle, centred on it, intersects no other target and no other undersized target's circle. Exempt: inline links in a sentence, targets the browser draws unstyled, a target with a same-function equivalent that passes, and a size the information requires.
- **Keyboard** (2.1.1, 2.1.2): every action works from the keyboard, and focus never gets trapped.
- **Reflow and text spacing** (1.4.10, 1.4.12): at 320 CSS px no content scrolls sideways, except content that needs two dimensions (a data table, a map, a diagram); with line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em applied, nothing clips or overlaps.
- **Dragging, authentication, help, entry** (2.5.7, 3.3.8, 3.2.6, 3.3.7): a single-pointer alternative for every drag, no cognitive test to sign in unless an alternative exists, paste and password managers work, or the test is object or personal-content recognition, help in the same place on every page, nothing asked twice in one flow. N/A only when the surface has none of these.
- **State-stable controls** (build rule above): read each control's `getBoundingClientRect()` in every state (idle, hover, loading, success, disabled); width and height match across states.
- **System and surfaces** (build rules above): colour roles exist in `DESIGN.md` before any component; each component names its shadcn/ui or project-kit source; a grep of the shipped styles finds no `backdrop-filter`, neumorphic double shadows, or mesh-gradient backgrounds unless the brief or a concrete reference supplies them.

On the grounded path, close the gap ledger row by row: each fixed gap has its before/after pair and the check that proves it.

### Layer 0 — architecture

| File | Read when |
|---|---|
| `design-system-architecture.md` | The project has no `DESIGN.md` (defines the structure you must create first — 8 sections plus a greenfield-only `## 0. Research Log`), or you are extracting a design system from existing UI code. |
| `material-first-workflow.md` | Building a greenfield brand showcase, landing page, or interactive product catalog without AI slop — enforces the 3-Document Separation (Purpose / UX & Data Flow / Visual Direction), the Material-First Gate (`products.ts` + `content.ts` + Fixed/Variable asset prompt templates before UI code), Bottom-Up assembly (`■ Material` + `● Component/Taxonomy` + `◆ Slot`), and Reverse-Order doc updates. |

### Layer A — taste skills (pick AT MOST ONE style skill; they encode opposing philosophies)

| File | Read when the user says… |
|---|---|
| `taste-skill.md` | Neutral or operational UI with no surface ambition — internal tools, dashboards, "just make it usable". The safe default; do NOT settle here when the brief signals glossy / premium / startup-grade craft. |
| `gpt-tasteskill.md` | "Awwwards-tier", "wow factor", "cinematic", "scroll-triggered" marketing/landing experiences. |
| `minimalist-skill.md` | "minimal", "clean", "Notion-like", "Linear-like", "editorial". |
| `brutalist-skill.md` | "brutalist", "raw", "Swiss", "experimental", "anti-design". |
| `soft-skill.md` | "premium", "luxury", "calm", "expensive", "elegant", AND glossy / glassy / liquid-glass / startup-grade product surfaces — pair with a high-craft Layer B (`supabase`, `linear.app`, `vercel`, `stripe`). |
| `redesign-skill.md` | Improving EXISTING UI — "this looks bad", "fix the design". Audit-first workflow; never use on greenfield. |
| `image-to-code-skill.md` | "Generate the design first, then code it." Pair with one image-brief reference (`imagegen-*.md`) below and generate via the `image-generator` subagent. |
| `output-skill.md` | Stacks on any style skill when output is incomplete — placeholders, `// TODO`, half-done components. |
| `stitch-skill.md` | Stacks on any style skill for Google Stitch compatibility or a `DESIGN.md` doc export. A complete worked export ships as `stitch-design-example.md`. |
| `interaction-skill.md` | Stacks on any style skill when work adds or changes interaction or motion. beui.dev-anchored: read the mapped component's source before designing an interaction; reduced motion always. |
| `ambience-skill.md` | Stacks on any style skill when work adds a hero atmosphere, animated background, typographic reveal, scroll chapter, or card surface effect. react-bits-anchored: read the mapped component's source, extract the mechanism, run the retrofit checklist; one atmosphere per hero, cursor effects quarantined. |
| `imagegen-frontend-web.md` / `imagegen-frontend-mobile.md` / `imagegen-brandkit.md` | Image-only output via the `image-generator` subagent (mockup, app-screen concepts, brand board). These NEVER write UI code — switch to `image-to-code-skill.md` if code is wanted. |

### Layer B — brand design systems (orthogonal to Layer A; stack freely — `nexu-io/open-design`: https://github.com/nexu-io/open-design)

When the user names a brand or site — "Linear-style", "like Stripe's landing", "Aside-style browser agent" — load `references/design/<brand>.md` as the token source of truth (palette, type scale, components, do/don'ts). Coverage includes `aside` `apple` `stripe` `linear.app` `notion` `vercel` `claude` `figma` `airbnb` `nike` `tesla` `spotify` `raycast` `revolut` and ~56 more; the full list with mood shortcuts is in `_INDEX.md`. Extract the tokens and apply them to the project's own content — never copy logos or trademarked imagery. If the named brand is missing, fall back to a Layer A mood match — or to the `open-design` skill only when that external skill is installed (it is not bundled here).

### React dev tooling

| File | Read when |
|---|---|
| `react-dev-tooling-skill.md` | A React project lacks react-grab / react-scan / react-doctor, or you need per-framework install snippets and the dev-only gating pattern (`NODE_ENV === 'development'`). |

## Ruleset 2 — perfection (`references/perfection/`)

| File | Read when |
|---|---|
| `README.md` | Any frontend code is written or audited. Carries the seven tenets: real-browser audits only, 100-in-every-category floor, fix-at-the-architecture, never weaken UX for points, design-system compliance checks, and the response format for audit reports. |
| `react-perf-tooling.md` | Before ANY React audit. The Playwright + `playwright-lighthouse` + `react-scan/lite` injection recipe, per-route render budgets, and the React-specific root-cause checklist. Lighthouse 100 with 30+ unnecessary renders is NOT done. |

Audit CLI (build for production first; never measure a dev server):

```bash
uv run $SKILL_DIR/scripts/perfection/lighthouse-audit.py https://localhost:3000
```

Run mobile AND desktop presets, 3–5 runs, take the median, diagnose from the JSON report.

## Ruleset 3 — ui-ux-db (`references/ui-ux-db/`)

`README.md` documents the search CLI and the master-plus-overrides persistence pattern. The CLI (run from the ruleset directory so it finds `data/`):

```bash
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --design-system -p "Project"   # full design-system generation
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --domain <domain>             # targeted lookup: product style typography color landing chart ux react web icons google-fonts
python3 -B $SKILL_DIR/references/ui-ux-db/scripts/search.py "<query>" --stack <stack>               # stack best practices: html-tailwind react nextjs vue svelte astro swiftui react-native flutter shadcn jetpack-compose
```

Domains: `product` `style` `typography` `color` `landing` `chart` `ux` `react` `web` `prompt`. Stacks: `html-tailwind` (default) `react` `nextjs` `vue` `svelte` `astro` `swiftui` `react-native` `flutter` `shadcn` `jetpack-compose`.

## Ruleset 4 — designpowers (`references/designpowers/`)

`README.md` routes the pinned `Owl-Listener/designpowers` corpus into this workflow. It supplies design context — personas, accessibility and cognitive constraints, critique, debt, handoff, synthetic user testing, motion, role prompts — that must be distilled into `DESIGN.md` first, then used as the implementation contract. It replaces nothing: not this skill, not `/visual-qa`, `/ulw`, or `gf-qa-behavioral-verification`.

## Quick routes — most common requests

| Request | Load |
|---|---|
| "Build a landing page" (no direction given) | `design/README.md` + `design/_INDEX.md` shortlist → exactly one Layer B reference + `design/taste-skill.md` + `perfection/README.md` |
| "Aside-style AI browser / browser agent page" | `design/README.md` + `design/aside.md` + `design/taste-skill.md` + `perfection/README.md` |
| "Linear-style landing page" | `design/README.md` + `design/linear.app.md` + `design/taste-skill.md` + `perfection/README.md` |
| "Premium SaaS hero like Stripe" | `design/README.md` + `design/stripe.md` + `design/soft-skill.md` + `perfection/README.md` |
| "Improve this existing dashboard" | `design/README.md` + `design/redesign-skill.md` + `perfection/README.md` |
| "Add micro-interactions" / "animate this" / "make it feel alive" / "polish the interactions" | `design/README.md` + `design/interaction-skill.md` on top of the current style skill + `perfection/README.md` |
| "Make the hero stunning" / "add an animated background" / "animate the headline" / "count-up / typewriter / marquee" / "spotlight or tilt cards" | `design/README.md` + `design/ambience-skill.md` on top of the current style skill + `perfection/README.md` |
| "Build this screenshot / `image-generator` mock / Stitch output exactly" | `design/README.md` + `design/image-to-code-skill.md` + `perfection/README.md` + `/visual-qa` reference-fidelity mode |
| "Audit my site" / "make this page faster" | `perfection/README.md` (+ `perfection/react-perf-tooling.md` if React) |
| "Mockup image of a fintech app" — no code | `design/imagegen-frontend-mobile.md` (+ a Layer B brand if named) |
| "What palette/fonts fit a wellness brand?" | `ui-ux-db/README.md` → search CLI |
| "Where should this go?" / "the layout breaks" / scroll + containment | `design/layout-skill.md` + `design/stylegallery.md` on the current style skill |
| "What do shipped apps in this space look like?" / design-direction research | `design/lazyweb.md` (curl-only) + `design/_INDEX.md` shortlist |
| "Set up this React project" | `design/README.md` + `design/react-dev-tooling-skill.md` |
| "Use designpowers", "make the design workflow stronger", "add personas/accessibility/debt/handoff" | `design/README.md` + `designpowers/README.md` (+ `perfection/README.md` if implementation or audit follows) |

## Shared axioms (all four rulesets agree — apply always)

- **No design system = no UI work.** `DESIGN.md` exists before components do; every color, font size, and spacing value traces back to a token in it.
- **Material-First before screens (greenfield brand/product pages).** Never jump straight to full-screen generation. Separate Purpose (one-sentence worldview + explicit exclusions), UX & Data Flow (typed `products.ts` / hierarchical `content.ts` + component assembly list), and Visual Direction (`DESIGN.md` tokens + Fixed/Variable asset templates) per `references/design/material-first-workflow.md`, then assemble bottom-up from primitives to page. When a section feels empty, update the UX/Data doc first, generate the missing material, and then wire the component.
- **Concrete reference = contract.** When a screenshot, mockup, or annotated reference exists, match its pixels, copy, component structure, and responsive intent unless the user accepts a deviation.
- **Never weaken UX OR flatten the surface to buy points.** No dropping animations, hiding content, simplifying interactions, or replacing rendered/lit material with flat fills and flat geometric primitives for a Lighthouse score or a deadline. Hit 100 AND keep the surface dimensional — both, or neither.
- **No emojis as icons.** SVG icon sets only (Lucide, Heroicons, Radix, Phosphor).
- **No coloured accent borders on rounded surfaces.** A `border-l-2 border-primary` stripe on a selected row, a primary-tinted outline on a focused card — any `border-{side}-{primary|warning|destructive|success}` or accent-width rule used to mark selected/focused/active is the most recognizable AI-slop tell in shipped UI. Encode state the way `DESIGN.md` systems do: one ink at many alphas (hover/selected/active wash ramps), a glyph (check) for selection, tonal layering for focus. Keyboard `focus-visible` rings are the only coloured edge allowed. Applies to code you write AND to pre-existing instances on any surface you touch — sweep them out.
- **GPU-composited animation only** — `transform`, `opacity`, `filter`; never animate layout properties.
- **Slop animation is forbidden — motion serves meaning.** Every animation or hover must map to a real interaction, state change, or affordance. A hover that changes nothing, motion on a non-interactive element, or a decorative micro-animation with no informational purpose is slop — do not add it.
- **Done is the `/visual-qa` dual-oracle gate, not your own glance.** A frontend design task is verified through `/visual-qa` (real browser at 375 / 768 / 1280px, every page, with interaction states and motion driven and inspected) until the dual-oracle completion gate passes on fresh evidence. The model never opens the browser on its own initiative; this gate is a mandatory step, and the 375px pass comes first because that is where generated layouts most often break.
- **Copy density cap.** One hero or card carries at most one headline (≤12 words / ≤20 Korean characters) and one supporting line (≤24 words / ≤60 Korean characters). A slide or landing section never holds more than three bullets of ≤12 words. When the brief supplies no copy, write the minimum that names the action, not a paragraph explaining it. Argon's default register is a dense essay; a screen is not an essay.
- **No fabricated numbers on the surface.** Stats tiles, "benchmark" panels, testimonials, and pricing come from the brief or a data file. If none exists, render a labeled placeholder (`—`), never an invented value.
- **Write in ≤100-line chunks and reopen the file.** Large single `write_file` / `edit_file` calls (≈1,000 lines; hard guard >250 lines or >24KB) risk host stream cutoff. Scaffold first, then fill section by section via `write_file` / `edit_file`, and read the file back with `read_file` before calling it rendered.

## When to load something else instead

| Situation | Load |
|---|---|
| Brand/style not among the 70 in `references/design/`, or the user says "Open Design" | `open-design` skill — the nexu-io/open-design library (https://github.com/nexu-io/open-design; 137+ design skills, 150+ design systems) — **only if installed in this session; it is not bundled in this plugin**. Otherwise design from the closest Layer A/B match. |
| Driving a browser for the Design QA phase or captures | `visual-qa` skill — drives the connected Antigravity browser MCP (renders, screenshots, signed-in pages) |
| Pure TypeScript/logic work with zero visual surface | `programming` skill alone — this skill adds nothing there |

## Activation

Use for any frontend, web UI, UX, visual, design, styling, layout, animation, performance, accessibility, or SEO work — building, redesigning, auditing, or generating mockups. Not for backend, CLI, or pure-logic tasks with no visual surface.
