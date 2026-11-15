# Craft floor: the numbers a build must clear

Adapted from the `craft-floor` reference of [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, Copyright 2025 Paul Bakaus), rewritten for this skill; see `ATTRIBUTION.md` section 6 for the license and the list of changes.

Read this with `README.md` for any code change. It sets no direction, and it has two kinds of line. Each line is checked on the rendered page by reading computed values, not by looking at the source. `/visual-qa` checks them again (A3, A13, B8, E7, F8, F9).

- **Floors** (marked *floor* below) hold under every style skill and brand. A project's `DESIGN.md` may raise them, never lower them.
- **Defaults** (every other line) hold until the brief asks otherwise. That means the brief's own words, a concrete reference, or a route the brief chose that names the value or pattern: a Layer A style skill or Layer B brand under `references/design/`, or the ambience route. Brutalist display scale and tracking, a brand's labels above headings, and the ambience route's blur reveals and glowing-border cards are examples. The route wins for that one item only. Record the deviation in the brief or `DESIGN.md` so `/visual-qa` reads it as chosen, not generated.

## Browser surfaces

*Floor.* The parts of a page the browser draws by default ship with no design unless you give them one. Theme every one that the surface has, from the palette tokens, in both themes:

| Surface | What to set |
|---|---|
| Text selection | `::selection { background: <accent at low alpha>; color: <ink> }`; the default system blue never shows. |
| Caret | `caret-color: <accent or ink>` on inputs, textareas and contenteditable. |
| Scrollbars | `scrollbar-color: <thumb> <track>` and `scrollbar-width: thin` on scroll containers that keep a visible bar. Overlay scrollbars stay overlay (`/visual-qa` A5); this styles the bar, it never adds a gutter. |
| Focus ring | `:focus-visible { outline: 2px solid <focus token>; outline-offset: 2px }`, visible on every surface colour. |
| Underlines | `text-underline-offset: 0.15em` to `0.25em` and `text-decoration-thickness` from the type scale on links, so the line clears descenders. |
| Numerals | `font-variant-numeric: tabular-nums` on every column, counter, timer, price and table cell that changes or aligns. |

Exempt: a surface with no instance of the element (no inputs means no caret), and a native control the brief keeps unstyled on purpose.

## Type and spacing floor

| Rule | Floor | Read from |
|---|---|---|
| Type scale steps (*floor*) | Each step of the heading ladder (display, h1, h2, h3) and the step from the smallest heading to body differ by at least 1.25x in size. The body-family roles (lead, body, small, caption, overline or label) may sit closer, but each also differs from its neighbour by weight, colour or case, never by size alone. | computed `font-size` of each role in use |
| Space around a heading | The space above a section heading is at least 1.5x the space below it, so the heading belongs to the content it introduces. | computed margin/padding plus the parent gap |
| Group separation | The gap between groups is at least 2x the gap inside a group. | computed `gap` / margins of siblings |
| Body measure (*floor*) | Body text runs 65-75 characters per line on desktop; 45 is the lower bound on a phone. | rendered line length at 1440 and 390 |
| Display size | A display heading stays at or under 6rem unless the chosen route sets a larger display scale. | computed `font-size` |
| Tracking | Letter spacing stays at or above -0.04em unless the chosen route sets tighter display tracking; -0.02em to -0.03em usually reads better on large type. Body text keeps 0. | computed `letter-spacing` / `font-size` |

Run the real copy at every captured width and fix what overflows or wraps a heading to four lines.

## Patterns kept out of the first draft

These extend the Draft guard in `SKILL.md`. Each one is what a generator reaches for when nothing decided otherwise, so the first draft leaves it out. The brief or its chosen route can still ask for one (see the defaults rule above). The hard offset shadow below is narrower than that.

- **Kicker above a heading.** A small uppercase or accent label sitting on top of a heading ("FEATURES", "01 - OVERVIEW"). Delete it; the heading carries its own weight.
- **Icon in a tile over a heading.** A rounded square holding an icon, stacked above a heading and a line of text, repeated across a grid of same-size cards. Use the content's own structure (a list, a table, a real image) instead of the card formula.
- **Hero metric.** One giant number with a small label, flanked by supporting stats and an accent. A number earns that size only when it is the decision the screen exists for.
- **Cards inside cards.** A bordered or shadowed box inside another. Separate inner groups with space or a neutral 1px rule.
- **Gray text on a coloured surface.** Secondary text on a tinted or coloured background takes a shade of that hue (or the foreground at reduced alpha), never neutral gray, which looks dirty and fails contrast first.
- **Monospace as a costume.** A monospace face only for code, data, ids and measurements, never to make a heading or a UI read as "technical".
- **Glow and halo shadows.** A shadow carries a y-offset and a soft blur. A zero-offset coloured glow around a card or button is decoration, unless the brief asked for glowing-border cards through the ambience route. Hard offset shadows with no blur (`4px 4px 0`) only when the brief chose a neobrutalist direction.

## What this skill does not take from the source

The upstream reference disagrees with rules this skill already holds; ours win:

- Blur, `backdrop-filter` and `filter: blur()` are not general motion materials. They animate only in an ambience reveal the brief asked for (`references/design/ambience-skill.md`), and never under `prefers-reduced-motion` (`/visual-qa` G4).
- A label above a heading is a default to leave out, not an absolute ban: a style route that allows a limited number of them (`taste-skill.md`) is followed.
- Both light and dark themes ship (`/visual-qa` E1); the theme is not picked per product category.
- An intentional spring is allowed where `DESIGN.md` names it; bounce easing is a finding only when no token asked for it.
- A typeface the project chose (for example Inter in a product that matches its platform) is never a finding because it is common.
- Scrollbars follow the overlay rule above; this skill never asks for a decorative custom scrollbar.

## Build rules (`Ruleset 1 — design`)

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
