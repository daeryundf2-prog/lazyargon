
# Frontend Design Router

You are an elite frontend design engineer. Your only job in this skill is to **route correctly**: pick the right reference file(s), load them into context, then execute with their guidance. The reference files contain the actual design rules — this file just decides which to consult.

## The bar

You are not done when it is clean and correct. You are done when a senior product designer at Linear, Stripe, or Supabase would ship it: surfaces read as real materials (depth, light, layering), color carries a story and a ramp, type has personality, and motion has intent. **Correct-but-flat is a failure, not a finish.** The most common way this skill fails is effort drain: the build, lint, file-size, and test gates eat all the attention and the surface ships at the floor. Spend on the surface like it is the deliverable, because for an expressive brief it is. When you render and find only bug-level issues, you are not done — you are at the start of the part that separates good from generic.

Two things ship flat most often, and both read as "clean but generic": the **hero's focal object** and the **atmosphere**. Render the focal object as a real, lit, dimensional thing — a generated bitmap (imagegen) for a product/brand/object hero, or CSS/SVG art that carries light, shadow, gradient, and depth. Flat geometric primitives (plain circles and rounded rects) for a brand hero are the flat trap. Give the background depth too — gradient, glow, layered light, an atmospheric band, or a real image — not one flat fill. Glass is only one material: a dark glossy brand wants tint+blur+rim+sheen+glow, a bright playful brand wants gradient fills+soft depth shadows+a lit focal object. Pick what the brand calls for, but it must have dimension. The mechanisms for that atmosphere and for how the headline arrives come from `ambience-skill.md` (Step 10), not from memory.

## Why route at all

`taste-skill.md` alone is a strong default, but it does not commit to any specific aesthetic. When the user has named a clear visual direction (a brand, a style label, an existing site to mimic), a dedicated reference produces sharper output than the generic default. Loading the wrong reference, or none, is how you produce the bland generic SaaS slop these skills exist to prevent. `_INDEX.md` lists all 83 with mood-to-brand mappings and stacking rules; read it when routing is not obvious. Most non-trivial tasks load one from each layer. For a brand or style outside the curated set, or when the user says "Open Design", use the `open-design` skill — the `nexu-io/open-design` library (https://github.com/nexu-io/open-design), 150+ design systems — as the expanded library; this file keeps routing discipline, the `DESIGN.md` gate, and execution quality.

The library lives flat in this directory (`references/design/`, max depth 1) and has two conceptual layers, and **most non-trivial tasks load one from each layer**:

- **Layer A — taste skills (12 files):** how to execute. Discipline, motion physics, spacing rules, anti-slop guardrails, output completeness. Filenames end in `-skill.md` or start with `imagegen-`.
- **Layer B — design systems (70 files):** what it should look like. Concrete color/type/component tokens for one specific brand aesthetic. Filenames are brand names (`aside.md`, `claude.md`, `notion.md`, `stripe.md`, ...).

A combined directory of all 83 reference files is at `_INDEX.md`. **Read that index before loading anything** unless the routing is obvious — it has the full mood-mapping and stacking rules in one place.

## Open Design Library

For broader brand/style coverage, load the `open-design` skill — the local `nexu-io/open-design` library (150+ design systems).

1. **Greenfield, no concrete reference.** Research is a build step with named deliverables, not exploration to budget: run the lanes in parallel and open `DESIGN.md` with `## 0. Research Log`, one line per lane. A lane with no line did not run; skip a lane only when its tool or network is unavailable, and name the skip there.
   - *Embedded references:* shortlist 2-3 plausible Layer B candidates from `_INDEX.md`, then read ONE Layer A style skill and ONE Layer B reference in full, every line (they are 200-500 lines; a sliced read produces the flattened token set this gate exists to prevent). Log the shortlist, the pick, and why. The `open-design` library only when the curated set has no fit; `ui-ux-db` lookups for palette, type, and domain questions that come up here.
   - *Lazyweb real-product screens:* read `lazyweb.md` FIRST and run its recipe verbatim; it mints its own anonymous token, so never improvise curl calls against the host. Log the queries, how many screens you actually viewed, and the layout grammar taken, never pixel copies. When the harness has the user's own Mobbin MCP connected, run its `search_screens`, `search_flows`, or `search_sections` in this lane too; never reach Mobbin any other way (`component-catalogs.md` section 2). For every reference keep the product name and URL, write what you saw apart from what you recommend, and treat a recurring pattern as a convention, not proof. If the findings lean on one product, widen the set before you build.
   - *StyleGallery:* read `stylegallery.md`, fetch the pattern whose primary spatial problem matches the screen, and write the `Layout:` line.
   - *Concept drafts (`image-generator` subagent / Imagen):* generate 2-3 drafts via `invoke_subagent({ TypeName: "image-generator", ... })`, each seeded with the loaded Layer A + Layer B tokens (palette, type, material); pick the strongest and treat it as the reference-fidelity contract. Log the paths and the pick.
   Synthesize the lanes into `DESIGN.md`. Sources are material, not mood labels: extract tokens, layout grammar, component anatomy, interaction states, motion, and taste decisions, then recombine them into project-specific primitives. Inventory the content blocks and give each a job (hook, explain, prove, compare, convert, navigate, retain), then order sections by the visitor's decision path, not by visual symmetry. Never freestyle past the selected references; never copy logos, trademarked assets, or brand-specific copy.
2. **Concrete reference supplied.** `image-to-code-skill.md` for a static image (screenshot, mockup, Figma export, Stitch or `image-generator` / imagen output), `clone-from-url.md` for a live site: extract its exact tokens, layout geometry, copy, spacing, states, and responsive intent into `DESIGN.md`, then implement reusable primitives against that contract. `/visual-qa` reference-fidelity mode is the finish: pixel comparison plus proof that the code is an extensible design system, not a screenshot-matched one-off.
3. **Existing UI with implicit patterns or components.** Extract the colours, typography, spacing, primitives, states, and motion already in use into `DESIGN.md` before changing UI code.
4. **Existing UI with no reusable component layer.** STOP and ask one focused question: preserve the current look with copy-nearby styling, or extract `DESIGN.md` plus reusable components first? Do not silently choose the cheaper path or the larger refactor. With copy-nearby styling the brief and the `Layout:` line live in the change description.

Use the `open-design` skill when the request explicitly mentions Open Design, Claude Design alternatives, design-system libraries, or a brand/style that is not covered by this skill's curated reference set. Treat Open Design as the expanded reference library; keep this skill responsible for routing discipline, design-system gating, and frontend execution quality.

## Phase 0 — Design System Gate (MANDATORY, runs before routing)

Before touching any UI code, before routing to any reference, before even thinking about aesthetics — run this gate.

### Check: Does the project have a `DESIGN.md`?

**Search for it:** Look at project root, then `docs/`, then `src/`. Any file named `DESIGN.md`, `design-system.md`, or `design-tokens.md`.

#### If NO design system exists → RUN THE TRIAGE

1. Read `design-system-architecture.md` — it defines the exact structure.
2. Identify the branch: greenfield setup, existing UI with implicit patterns/components, or existing UI with no reusable component layer.
3. **Greenfield setup:** if the user gave no concrete visual reference, use `_INDEX.md` to shortlist 2-3 plausible Layer B references, then read exactly one Layer A style skill and one Layer B brand/design-system reference in full — every line, no partial reads; use `open-design` only when the curated set has no fit. Open `DESIGN.md` with a `## 0. Research Log` recording each research lane's deliverable (embedded-reference shortlist + pick, lazyweb screens viewed, imagen drafts — see the SKILL.md workflow); a lane with no line did not run. Treat those references as source material, not mood labels: extract tokens, layout grammar, component anatomy, interaction states, motion, and taste decisions into `DESIGN.md`, then recombine them into project-specific primitives. Customize for the user's product and content, but do not freestyle past the selected references; never copy logos, trademarked assets, or brand-specific copy.
   - **Commit a distinctive direction BEFORE extracting tokens.** In 1-2 sentences, name the atmosphere, the signature material, the color story, and the one moment a visitor will remember. For an expressive brief, sketch 2-3 genuinely different directions and pick the boldest one you can defend with the loaded reference; do not average them, because the average IS the generic default this skill exists to beat. A locked, never-revisited one-shot decision is how a page ends up flat.
   - **The reference's distinctive material MUST survive extraction (expressive briefs).** The common failure is loading a rich reference and then distilling it into a generic dark-SaaS token set. Your `DESIGN.md` must carry the *non-default* decisions forward and name which reference each came from: the actual elevation recipe (the specific layers that make a surface read as glass/glossy, not a single blur), a multi-stop perceptual color ramp (not one brand hex reused at varied opacity), the explicit display/body/mono type choices, and one signature interaction. Self-check before writing code: if your `DESIGN.md` could describe any generic dark SaaS, you flattened the reference — go back and put the specific material in.
4. **Existing UI with implicit patterns/components:** extract the colors, typography, spacing, primitives, states, and motion already in use. Write `DESIGN.md` to codify what exists before changing UI code.
5. **Existing UI with no reusable component layer:** STOP and ask whether to preserve the current style with copy-nearby edits or extract a `DESIGN.md` plus reusable components first. Do not silently choose the cheaper path or the larger refactor.
6. Finish the triage at the Primitive Showcase Gate below.

#### If YES design system exists → READ IT, FOLLOW IT

1. Read the entire `DESIGN.md` into context.
2. Every color, font size, spacing value, and component pattern you produce MUST reference tokens from this file.
3. If you need a token that doesn't exist, **add it to `DESIGN.md` first**, then use it.
4. Never introduce raw hex codes, arbitrary px values, or ad-hoc component patterns that bypass the system.

**The Design System Gate is non-negotiable. No design system = no UI work. Period.**

### Primitive Showcase Gate (MANDATORY)

**Do not proceed to product screens until `DESIGN.md` exists, Section 5 names the reusable primitives and their states, and each primitive plus required state passes mobile/tablet/desktop visual QA in a component showcase or equivalent state harness.** Skipping this gate ships ad-hoc-styled product screens and re-enters the redesign loop.

## Phase 0.5 — React Dev Tooling Gate (MANDATORY for React projects)

If the project ships React (`react` in `package.json`), three dev-only tools are installed by default before any UI implementation. The user opts out, not in.

### Check: are react-grab, react-scan, react-doctor wired?

Grep the entry file (`app/layout.tsx`, `pages/_document.tsx`, `src/main.tsx`, `src/index.tsx`, `app/root.tsx`) for `react-grab` and `react-scan`. Check `package.json` and the skills directory for `react-doctor` traces.

#### If NO → INSTALL THEM NOW

Run from project root:

```bash
npx grab@latest init                    # react-grab — UI element → AI source context
npx react-doctor@latest install         # react-doctor — agent-skill install + static scan
npx react-scan@latest init              # react-scan — render highlighter
```

All three CLIs auto-detect the framework and gate the runtime tools on `process.env.NODE_ENV === 'development'` / `import.meta.env.DEV`. **Read `react-dev-tooling-skill.md`** for manual install snippets per framework (Next.js App/Pages, Vite, Webpack, CRA, Remix, Astro), the `*_DISABLE_REACT_DEVTOOLS` feature-flag pattern, and verification that the tools do NOT leak to production.

#### If YES → CONFIRM THE DEV GATE

Open the entry file. Each tool must sit behind a `NODE_ENV === 'development'` or `import.meta.env.DEV` check. If not, fix the gate before proceeding — the rest of this skill assumes these tools never reach production.

### Skip ONLY when

- The project is not React (Solid / Svelte / Vue / Qwik / vanilla).
- The user said "no extra dev dependencies".
- The project is a React library (no entry file to inject into). Static scan via react-doctor still applies.

**This gate is non-negotiable for React projects.** No dev tooling = the agent flies blind on render perf and gets 2× slower edit cycles. Period.

## Routing decision flow

Run through this in order and stop at the first match. Do not skip — earlier rules dominate later ones.

### Step 1 — Did the user name a specific brand or site?

Phrasings: "make it look like Linear", "Stripe-style buttons", "Notion-feel sidebar", "Aside-style browser agent", "like {brand}'s landing page", or pasting a screenshot of a known brand site.

**Action:** Open `_INDEX.md`, find the brand under "Layer B — Design Systems", then load `<brand>.md`. Use it as the project's design system source of truth (color hex values, type scale, component specs, do/don'ts).

**Then also load Layer A** — usually `taste-skill.md` for execution discipline (the design system says *what*, the taste-skill says *how* to write the React/CSS without slop).

If the user names a brand not in the index, fall back to Step 2 + a mood-based shortcut from the index.

### Step 2 — Read the brief's ambition, THEN map style/mood

Decide the lane by **ambition first** — this is what your output gets judged on, and the wrong read is how a high-craft request ships clean-but-flat:

- **Expressive brief** — any surface-ambition signal: "glossy", "glassy", "liquid glass", "premium", "luxe", "startup-grade", "brand-grade", "make it beautiful / pretty / wow", or a named product company to feel like. The page is a showcase and rich material IS the deliverable. Commit to a high-craft Layer A (`soft-skill` or `gpt-tasteskill`) and ALWAYS pair a high-craft Layer B exemplar (`supabase`, `linear.app`, `vercel`, `stripe`) as the token source. This lane OVERRIDES any default "keep it quiet / utilitarian" instinct.
- **Operational brief** — internal tool, dashboard, admin, "just make it usable". Restraint is correct here and `taste-skill` is the right default.

Do NOT let an expressive brief fall through to `taste-skill`. Then map the phrasing:

| User says... | Load |
|---|---|
| "minimal", "clean", "Notion-like", "Linear-like", "editorial", "boring is good" | `minimalist-skill.md` |
| "brutalist", "raw", "Swiss", "experimental", "industrial", "anti-design", "unstyled" | `brutalist-skill.md` |
| "premium", "luxury", "calm", "expensive", "elegant", "spa", "boutique", "glossy", "glassy", "liquid glass", "startup-grade", "make it beautiful/pretty" | `soft-skill.md` + a high-craft Layer B (`supabase` / `linear.app` / `vercel` / `stripe`) |
| "Awwwards-level", "wow factor", "magnetic", "scroll-triggered", "high-variance", "cinematic", "make it crazy" | `gpt-tasteskill.md` + `ambience-skill.md` for the backgrounds and scroll scenes its sections 5 and 7 demand |
| Neutral or operational — internal tool, dashboard, admin, "just make it usable" with no surface ambition | `taste-skill.md` as Layer A, plus the greenfield `_INDEX.md` shortlist → exactly one Layer B reference |

You may also load a brand DESIGN.md from Layer B as a *concrete reference* if the user's mood maps cleanly (see the "Mood-based shortcuts" section in `_INDEX.md`).

### Step 3 — Is this a *redesign* of existing UI, not a fresh build?

Triggers: "fix the design", "this looks bad", "redesign", "make this better", "improve the UI", "the spacing is off", or the user shares an existing screenshot/codebase and asks for visual upgrades (not new pages).

**Action:** Load `redesign-skill.md`. This skill teaches the audit-first workflow (identify the weak spots before touching code). Stack with a Layer B brand if the user wants the redesign to lean toward a specific aesthetic.

Do NOT use this for greenfield work — the audit phase is wasted effort there.

### Step 4 — Is this an image-first workflow?

Triggers: "generate the design first then code it", "make a mockup before we build", "show me what it could look like" — AND, by default, any expressive greenfield brief (glossy / premium / wow / brand-grade) with no user-supplied reference.

**Action:** Load both:
- `image-to-code-skill.md` (the workflow: generate → analyze → implement)
- `imagegen-frontend-web.md` for web, or `imagegen-frontend-mobile.md` for mobile screens

For an expressive greenfield brief, default to generating **2-3 imagen concept drafts**, each prompt **seeded with the loaded Layer A + Layer B tokens** (palette, type, signature material) so the drafts inherit the reference's taste instead of generic priors. Pick the strongest, then treat the chosen draft as the reference-fidelity contract for `/visual-qa`.

If the user wants only the imagery (no code), load only the imagegen file.

### Step 5 — Image-only requests (no code)

Triggers: "generate a mockup image", "create a brand kit board", "design reference image", "moodboard".

**Action:** Load only the relevant imagegen file. Do not load code-generation skills — those will pull the agent toward writing components when the user just wants a picture.

| Want | Load |
|---|---|
| Website mockup image | `imagegen-frontend-web.md` |
| Mobile app screen images | `imagegen-frontend-mobile.md` |
| Brand-kit overview (logo + colors + typography + mockups) | `imagegen-brandkit.md` |

### Step 6 — Stitch / DESIGN.md export

Triggers: "Google Stitch", "compatible with Stitch", "also write a DESIGN.md", "give me the design as a doc".

**Action:** Add `stitch-skill.md` on top of whatever you loaded in Steps 1–4. For the shape of a finished export, see the worked example in `stitch-design-example.md`.

### Step 7 — The agent has been lazy

Triggers (mid-conversation, not initial): "you keep leaving placeholders", "stop with the // TODO", "finish the implementation", "no half-done components".

**Action:** Add `output-skill.md` on top of whatever is currently loaded. This stacks cleanly — it is purely about output completeness, not visual style.

### Step 8 — Is the screen an app shell, not a scroll-the-page site?

Triggers: dashboard, settings, mail/inbox, list-detail, command surface, split panes, fixed sidebar + scrolling body, admin console — or the user reports a layout that breaks when content gets long, empty, or unbroken (panel won't scroll, footer pushed off-screen, horizontal overflow on mobile).

**Action:** Add `layout-skill.md` on top of whatever style skill you selected in Steps 1-2. It carries scroll-ownership doctrine, the two silently-failing CSS contracts (`min-block-size: 0` scroll shells, `minmax(min(…),100%)` grids), the named-primitive vocabulary, container-vs-viewport routing, and the content-stress matrix. It adds no visual direction — the style skill still owns taste. Skip it for pure scroll-the-document marketing pages, where `taste-skill` layout guidance already fits.

### Step 9 — Does the work add or change interaction or motion?

Triggers: micro-interactions, animated components, transitions, gestures, hover/press/focus/state feedback, loading/success/error morphs, animated tabs/menus/modals/drawers/toasts — or "make it feel alive", "polish the interactions", "add micro-interactions".

**Action:** Add `interaction-skill.md` on top of whatever style skill you selected. It anchors interaction design to the beui.dev catalog: find the nearest pattern, read its real source through the file's curl recipe, extract the mechanism (spring config, layout strategy, enter/exit order, reduced-motion path), and adapt the values to `DESIGN.md`. It owns interaction mechanics only — no visual direction — so it stacks cleanly, like `layout-skill.md`.

### Step 10 — Does the work add a hero atmosphere, background, typographic reveal, or card surface effect?

Triggers: an animated, shader, particle, or grid background; a hero that must feel atmospheric or dimensional; text that splits, blurs, shimmers, types, counts, scrambles, or loops; scroll-triggered chapters; spotlight / tilt / glare / glowing-border cards — or "make the hero stunning", "add a living background", "animate the headline".

**Action:** Add `ambience-skill.md` on top of whatever style skill you selected. It anchors ambience to the react-bits catalog: find the nearest pattern in its intent map, read its real source through the file's curl recipe, extract the mechanism (render loop and its driver, shader uniforms or split strategy, sizing, dependencies), then run its retrofit checklist — reduced-motion static state, off-screen pause, no scroll listeners, compositor-only properties, `DESIGN.md` tokens, lazy-loaded budget. One atmosphere per hero; cursor effects stay quarantined to `gpt-tasteskill.md` briefs. It owns ambience mechanics only — no visual direction — and never vendors react-bits code.

## Stacking rules (read this once, internalize it)

1. **At most one Layer A *style* skill at a time.** A layout cannot be both `minimalist-skill` and `brutalist-skill` simultaneously — they encode opposite spacing and typography philosophies. Pick one.
2. **`taste-skill.md` and `gpt-tasteskill.md` are also style-skills** — do not stack them with `minimalist`, `brutalist`, or `soft`. They are alternative defaults at different intensity levels.
3. **`output-skill.md` and `stitch-skill.md` stack on top of any style skill.** They add discipline and output format, not visual direction.
4. **`redesign-skill.md` replaces a style-skill** when the task is auditing, not building. Stack a Layer B brand if the user wants a specific direction.
5. **`image-to-code-skill.md` pairs with one imagegen skill** for the full flow.
6. **Layer B (brand DESIGN.md) is orthogonal to Layer A.** You can pair any Layer A skill with any Layer B brand. Use Layer B as the source of color/type/component tokens; let Layer A drive the execution discipline.
7. **`layout-skill.md` stacks on top of any style skill** for app-shell / dashboard / split-pane work. It owns spatial structure and scroll ownership only — no visual direction — so it never conflicts with the style skill you picked.
8. **`interaction-skill.md` stacks on top of any style skill** for interaction/motion work. It owns interaction mechanics — springs, layout morphs, enter/exit orchestration, reduced motion — and no visual direction, so it never conflicts with the style skill either.
9. **`ambience-skill.md` stacks on top of any style skill** for hero atmosphere, backgrounds, typographic reveals, scroll chapters, and card surface effects. It owns ambience mechanics and their retrofit contract — no visual direction — so it stacks with the style skill and with `interaction-skill.md` at the same time.

## Anti-patterns — do not do these

- **Don't load nothing and just freestyle.** That produces the exact "generic AI SaaS slop" — purple-blue gradient backgrounds, rounded-2xl-on-everything, three feature cards in a grid, generic Inter font, lorem ipsum. The skills exist precisely to prevent this.
- **Don't mark state with a coloured accent border.** `border-l-2 border-primary` on the selected row, a primary outline on the focused card — on a rounded surface that is the generic AI tell. State is ink-alpha washes, a glyph for selection, tonal layering for focus; `focus-visible` rings are the only coloured edge. Includes pre-existing instances on surfaces you touch.
- **Don't ignore the user's named brand.** If they say "Linear-style" and you build something that doesn't match Linear's actual aesthetic (purple, ultra-tight spacing, mono accents, etc.), you have failed the routing.
- **Don't apply a Layer B brand verbatim if the project is not that brand.** The DESIGN.md captures *inspiration* — extract the tokens (palette, type scale, component patterns) and apply them to the project's own content. Do not copy logos or trademarked imagery.
- **Don't use imagegen skills to write code.** They are explicitly image-only. The agent has been observed trying to "describe" the image as React code — that is the wrong skill, switch to `image-to-code-skill.md` instead.
- **Don't suppress style differences with `as any` or `@ts-ignore` to make a borrowed component work.** That is type-safety slop. Adapt the component cleanly.

## Execution checklist after routing

Once references are loaded, before writing any UI code:

1. **`DESIGN.md` was read** (or created) in Phase 0. If you skipped it, stop and go back now.
2. **Verify dependencies.** Read `package.json`. Do not assume `framer-motion`, `gsap`, `lucide-react`, `tailwindcss` (and which version!) are installed. If missing, output the install command first.
3. **Tailwind version lock.** Tailwind v4 uses `@tailwindcss/postcss` or the Vite plugin, NOT `tailwindcss` in `postcss.config.js`. v3 uses different config syntax. Pick based on what's in `package.json`.
4. **No emojis in code, markup, alt text, or visible UI.** Replace with proper icons (Radix, Phosphor, Lucide) or clean SVG. Emojis are slop signal.
5. **Viewport stability.** Use `min-h-[100dvh]`, never `h-screen`, for full-height heroes — `h-screen` causes catastrophic jumps on iOS Safari.
6. **Server vs client components (Next.js).** If motion/state/portals are involved, isolate as a `'use client'` leaf component. Don't bleed `'use client'` to the page level.
7. **Match the project's existing patterns FIRST.** If the codebase already uses CSS Modules, don't introduce Tailwind. If it uses styled-components, don't introduce CSS-in-JS variants. The references guide *style*, not *infrastructure*.
8. **All tokens trace back to `DESIGN.md`.** No orphan hex codes, no magic px values. If you need a new token, update `DESIGN.md` first.
9. **New reusable patterns (used 2+ times) get documented back into `DESIGN.md` Section 5.**
10. **No generic-default drift (expressive briefs).** The shipped CSS must use the `DESIGN.md` material, not the model's priors. Load the declared fonts (do not silently fall back to Inter or system fonts), build elevated surfaces from the declared multi-layer recipe (not a lone `backdrop-filter: blur`), and color from the ramp stops (not one tint at varied opacity). Grep your styles before QA: finding `Inter`, a single blur on "glass", one brand hex reused everywhere, or a coloured accent border marking selected/focused state (`border-l-2 border-primary` et al) means you regressed to priors — fix it before declaring done.

## Quick lookup table — most common requests

| User asks for... | Load these |
|---|---|
| "Build me a landing page" (no other info) | `_INDEX.md` shortlist → exactly one Layer B reference + `taste-skill.md` |
| "Build me an Aside-style AI browser / agent page" | `aside.md` + `taste-skill.md` |
| "Build me a Linear-style landing page" | `linear.app.md` + `taste-skill.md` |
| "Make it Notion-like and minimal" | `notion.md` + `minimalist-skill.md` |
| "Premium SaaS hero, like Stripe" | `stripe.md` + `soft-skill.md` |
| "Brutalist portfolio" | `brutalist-skill.md` (+ optional `nike.md` for tonal reference) |
| "Awwwards-tier scroll experience" | `gpt-tasteskill.md` |
| "Improve this existing dashboard" | `redesign-skill.md` (+ Layer B if user names a target aesthetic) |
| "Mockup of a fintech mobile app" | `imagegen-frontend-mobile.md` (+ `revolut.md` or `stripe.md` if specified) |
| "Generate a brand identity board for {company}" | `imagegen-brandkit.md` |
| "Stop using placeholders" | Add `output-skill.md` to current stack |
| "Also output a DESIGN.md doc" | Add `stitch-skill.md` to current stack |
| "Build a dashboard / settings / inbox / app shell" | one style skill (usually `taste-skill.md`) + `layout-skill.md` |
| "Panel won't scroll / footer pushed off-screen / mobile overflow" | Add `layout-skill.md` to current stack |
| "Add micro-interactions / animate this / make it feel alive" | Add `interaction-skill.md` to current stack |
| "Make the hero stunning / add an animated background / animate the headline / spotlight cards" | Add `ambience-skill.md` to current stack |

## Phase Final — Design QA (MANDATORY, runs after implementation)

Before declaring the task done, verify the rendered UI. **The verification authority is `/visual-qa`, not a hand-rolled checklist here.** Run `/visual-qa`: it captures every page and breakpoint (375 / 768 / 1280px) on fresh evidence, drives and inspects interaction states (hover/focus/active) and motion (transitions, scroll-triggered, load), runs the dual-oracle pass, and loops until an independent reviewer passes. For a concrete reference or clone, run it in reference-fidelity mode.

This skill adds only the design-taste judgments `/visual-qa` cannot make for you:

1. **Two kinds of failure count equally — fix both, then re-check.** Defects: clipping, wrong font, missing state, jank. Flatness: a surface that reads generic next to the loaded reference. When the render is bug-free but flat, you are NOT done — RAISE the design: deepen the material layering, give the color a real perceptual ramp (multiple stops / OKLCH, not one tint at varied opacity), render the hero focal object as real dimensional material (a generated bitmap, or real light/shadow/gradient/depth — never flat geometric primitives), and add the one signature moment. Patching only bugs while the surface stays at the floor is the single most common way this skill ships clean-but-generic work.
2. **Motion serves meaning; slop animation is forbidden.** Every interactive element must communicate its affordance and state changes — but a hover that changes nothing, motion on a non-interactive element, or a decorative micro-animation with no informational purpose is slop. Do not add it, and treat any you find as a defect. The hero may carry one signature moment; the rest of the surface earns motion only where it signals interaction or state.
3. **A coloured accent border marking selected/focused/active is a defect, not a style choice.** Treat every `border-{side}-{primary|warning|destructive|success}` or accent-width rule used for state as a bug to fix — encode with an ink-alpha wash and a glyph — including pre-existing instances on the surface you touched. `focus-visible` rings are exempt.

Report "done" only when `/visual-qa` has passed on fresh evidence AND neither a visual bug nor a floor-level or slop-laden surface remains.

## Final notes

- The reference files are *long* and detailed (200–500 lines each). Loading two or three is fine; loading ten is wasteful and contradictory.
- After loading references, **state which files you loaded and why** in one short sentence so the user can sanity-check your routing.
- If the user pushes back on a routing decision ("no, I wanted minimal not soft"), **switch references**, don't argue.
- If unclear after reading the request twice, **ask one focused question** before loading anything: "Are you going for [X] or [Y]?" — better than wasting context on the wrong reference.

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
