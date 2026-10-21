---
name: material-first-workflow
description: "DDD Material-First & 3-Document Architecture for anti-slop brand/product surfaces. Separates Purpose (Project Summary), Structure (UX & Data Spec), and Style (DESIGN.md), builds typed data and invariant/variant image assets before UI code, and assembles bottom-up."
---

# Material-First & 3-Document Workflow (Anti-Slop Assembly)

AI-generated websites look identical ("AI slop" — generic glass cards, arbitrary gradients, template grids) when the agent is told to "build the screen" directly. Without separated causal documents and pre-built materials, the model falls back to its statistical average layout.

Use this workflow whenever building a greenfield brand showcase, landing page, interactive product catalog, or redesigning an existing surface to eliminate AI-slop traits.

---

## 1. The Three Separated Decisions (Never Mix in One Document)

Before writing a single line of JSX/CSS, separate Purpose, Structure, and Visual Direction. In `DESIGN.md` (or companion `docs/01-brief.md` + `docs/02-ux-flow.md`), lock these three layers independently:

| Layer | Document / Section | What It Decides | Anti-Slop Function |
| :--- | :--- | :--- | :--- |
| **1. Purpose (`Project Summary`)** | `docs/01-brief.md` or `DESIGN.md §1.1` | **One-sentence worldview** (who it is for, what state they meet the product in) + **Explicit Exclusions** (what this brand NEVER does: e.g., "no gradients", "no rounded-2xl shadow cards", "line-divided grid only"). | Prevents default SaaS clichés before layout begins. |
| **2. Structure (`UX & Data Flow`)** | `docs/02-ux-flow.md` or `DESIGN.md §1.2` | **User scenarios**, **Typed Data Schemas** (`ProductData`, `ContentData`), and the **Component Assembly List** (with the reason each component exists, written *before* visual styling). | Lets information hierarchy dictate layout naturally instead of forcing content into a stock template. |
| **3. Style (`Visual Direction`)** | `DESIGN.md §2–§7` | **Perceptual color ramp / state tokens** (e.g., 4-stage time-of-day tokens, 3800K warmth), **typography scale**, and the **Asset Prompt Template** (Fixed DNA vs. Variable Spec). | Serves as the token source of truth and asset generator seed—not a vague mood prompt repeated on every component call. |

---

## 2. Material-First Gate (Data & Assets Before UI Code)

Never hardcode copy, specs, or raw image URLs inside React/UI components. Build the materials first so components only define slots.

### 2.1. Typed Data Separation (`Product Data` & `Content Data`)
1. **`src/data/products.ts` (Domain / Spec Data)**: Define the strict schema and full array of items (IDs, names, categories, states, day/night or variant image paths) before building any card or grid.
2. **`src/data/content.ts` (Hierarchical Copy Data)**: Structure all site copy by semantic hierarchy (like a book's table of contents: `hero.title`, `hero.tagline`, `brandValues[0..2]`).
   - **Hierarchy drives layout**: When copy is structured into 1 headline + 3 subordinate brand pillars in `content.ts`, the hero + 3-column `LineGrid` layout emerges directly from data shape.
   - **Korean copy de-slop**: For Korean surfaces, pass `content.ts` strings through `$humanize-korean` rules (no translationese, no "혁신적인/선사합니다") before rendering.

### 2.2. Invariant (A) + Variant (B) Asset Pipeline (`$image-prompt`)
When generating product photos or brand mood visuals, never write ad-hoc prompts per image:
- **Fixed Slot A (Brand Invariants)**: Material & finish (e.g., matte black anodized aluminum, frosted white glass), color temperature (e.g., `3800K` warm glow), camera framing (orthographic front view, generous negative space), and exact background hex matching the surface token.
- **Variable Slot B (Item Specs)**: Only the item's geometry, mounting type, or spatial persona placement changes across the batch (e.g., 20 lighting fixtures × day/night pairs in `.jsonl`).

---

## 3. Bottom-Up Assembly & The 3-Part Prompt Formula

Assemble in a live workbench (Storybook or the `DESIGN.md` Primitive Showcase route) from smallest to largest:
1. **Smallest unit**: `ProductCard` / `BrandValueCard` (fed by `products.ts` / `content.ts`)
2. **Collection unit**: `ProductGrid` + `ProductFilter` (with continuous state transition)
3. **Cross-state / Motion**: Multi-stage theme blending (e.g., syncing image blend ratios `100:5` / `75:25` with 4-stage surface background tokens so item backgrounds vanish into the page) + `SharedLayoutAnimation` (`layoutId`) into detail views.
4. **Sections to Page**: `HeroSection` + `BrandValueSection` (`LineGrid`) + bridge sections (`HorizontalScroll` panorama) → `App`.

### Subagent / Assembly Prompt Formula (`■ Material` + `● Named Pattern` + `◆ Slot`)
When delegating component assembly or prompting within this workflow, keep instructions to 1–2 unambiguous sentences combining three elements:
- **`■ Prepared Material`**: Exact keys from `content.ts`, `products.ts`, or generated asset paths.
- **`● Existing Component / Taxonomy Name`**: Reusable primitive (`LineGrid`, `ProductCard`) or exact taxonomy pattern (`SharedLayoutAnimation`, `HorizontalScroll` from `stylegallery.md` / `interaction-skill.md` / `ambience-skill.md`).
- **`◆ Target Placement / Ratio`**: Grid ratio and spatial slot (e.g., *"Place [■ the two brand mood photos] in [● LineGrid at a 2:1 ratio], and place [■ brand name + tagline from content.ts] at [◆ top-left]."*).

---

## 4. Reverse-Order Iteration Rule (Fix the Doc, Then the Screen)

When a composed page feels empty or lacks narrative continuity between sections (e.g., jumping abruptly from Hero to Product Grid):
1. **Do NOT patch the JSX directly.** Ad-hoc UI patches reintroduce AI slop.
2. **Return to `UX & Data Flow` (`docs/02-ux-flow.md` / `DESIGN.md`)**: Diagnose the missing narrative bridge in prose first (e.g., add a Brand Message section + a `HorizontalScroll` panorama timeline section).
3. **Generate the missing materials**: Add the new copy hierarchy to `content.ts` and generate the panorama images using the existing **Fixed Slot A** prompt template (changing only spatial framing in Slot B).
4. **Assemble the new section** using the named taxonomy pattern (`HorizontalScroll`).
