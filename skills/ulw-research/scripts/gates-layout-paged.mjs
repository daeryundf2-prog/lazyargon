// gates-layout-paged.mjs - L6-L9 paged, print-shrink, and heading-proximity layout gates.

import { DEFECT_CODES } from "./contracts.mjs"

export const PAGE_FILL_MIN = 0.6
export const CELL_VOID_ROW_MIN_PX = 84
export const CELL_CONTENT_RATIO_MAX = 0.3
export const CELL_VOID_MIN_PX = 52
export const A4_PRINT_INNER_MAX_PX = 674
export const HEADING_RATIO_MIN = 1.5

const IN_FLOW = new Set(["static", "relative"])
const r1 = (n) => Math.round(n * 10) / 10

function defect(code, selector, message) {
	const { severity, hint } = DEFECT_CODES[code]
	return { code, severity, selector, line: null, message, hint }
}

// L6: non-cover, non-final page containers whose in-flow body children fill less than 60% of inner height (>40% bottom void).
export function checkPageUnderfill(boxes) {
	const pages = boxes.filter((b) => b.isPage && b.rect && b.rect.h >= 400)
	if (pages.length < 2) return []
	const defects = []
	for (let i = 0; i < pages.length; i += 1) {
		const page = pages[i]
		const isFinalPage = page.pageTotal !== null && page.pageTotal !== undefined && page.pageIndex !== null && page.pageIndex !== undefined
			? page.pageIndex >= page.pageTotal - 1
			: i >= pages.length - 1
		if (isFinalPage || page.isCover || (page.flowCount !== undefined && page.flowCount <= 1) || page.flowBottom === null || page.flowBottom === undefined) continue
		const pt = page.spacing?.pt ?? 0
		const pb = page.spacing?.pb ?? 0
		const innerH = r1(page.rect.h - pt - pb)
		if (innerH <= 0) continue
		const usedH = r1(page.flowBottom - (page.rect.y + pt))
		const fillRatio = usedH / innerH
		if (fillRatio < PAGE_FILL_MIN) {
			const voidPct = ((1 - fillRatio) * 100).toFixed(1)
			defects.push(defect("layout_page_underfill", page.selector, `${page.selector} leaves ${voidPct}% vertical bottom void (used ${usedH}px of ${innerH}px inner height)`))
		}
	}
	return defects
}

// L7: table rows >= 84px tall where >= 50% of non-empty 1x1 text cells use <= 30% of the row's inner height (>= 52px vertical void) while a sibling cell in the same row drives the height.
export function checkCellVoidImbalance(boxes) {
	const rows = new Map()
	for (const box of boxes) {
		if ((box.tag !== "td" && box.tag !== "th") || !box.parentSelector) continue
		if (box.span && (box.span.row > 1 || box.span.col > 1 || box.span.hasMedia)) continue
		if (typeof box.contentH !== "number") continue
		if ((box.textLen !== undefined && box.textLen === 0) || box.contentH <= 0) continue
		const list = rows.get(box.parentSelector) ?? []
		list.push(box)
		rows.set(box.parentSelector, list)
	}
	const trBySelector = new Map(boxes.filter((b) => b.tag === "tr").map((b) => [b.selector, b]))
	const defects = []
	for (const [rowSelector, cells] of rows.entries()) {
		if (cells.length < 2) continue
		const tr = trBySelector.get(rowSelector)
		if (tr?.isSubRow) continue
		const rowH = tr ? tr.rect.h : Math.max(...cells.map((c) => c.rect.h))
		if (rowH < CELL_VOID_ROW_MIN_PX) continue
		const maxCellContentH = Math.max(...cells.map((c) => c.contentH))
		if (maxCellContentH < CELL_VOID_MIN_PX) continue
		const sparseCells = cells.filter((c) => {
			const availH = r1(c.rect.h - (c.spacing?.pt ?? 0) - (c.spacing?.pb ?? 0))
			return availH > 0 && c.contentH / availH <= CELL_CONTENT_RATIO_MAX && r1(availH - c.contentH) >= CELL_VOID_MIN_PX
		})
		const minSparseRequired = cells.length === 2 ? 1 : Math.ceil(cells.length * 0.5)
		if (sparseCells.length >= minSparseRequired && sparseCells.length < cells.length) {
			const voidPx = Math.max(...sparseCells.map((c) => r1(c.rect.h - (c.spacing?.pt ?? 0) - (c.spacing?.pb ?? 0) - c.contentH)))
			defects.push(defect("layout_cell_void_imbalance", rowSelector, `${rowSelector} is ${rowH}px tall while ${sparseCells.length}/${cells.length} cells leave up to ${voidPx}px of vertical empty void`))
		}
	}
	return defects
}

// L8: Chromium Print Shrink-to-Fit guard — tables or nowrap cells inside paged reports exceeding 674px (178mm A4 inner width), or nowrap sub-rows >95ch.
export function checkPrintShrinkRisk(boxes) {
	if (!boxes.some((b) => b.isPage)) return []
	const defects = []
	for (const box of boxes) {
		if (box.tag === "table") {
			const w = Math.max(box.rect?.w ?? 0, box.scroll?.sw ?? 0)
			if (r1(w) > A4_PRINT_INNER_MAX_PX) {
				defects.push(defect("layout_print_shrink_risk", box.selector, `table width ${r1(w)}px exceeds A4 printable width (${A4_PRINT_INNER_MAX_PX}px / 178mm), triggering Chromium Print Shrink-to-Fit downscaling`))
			}
		} else if ((box.tag === "td" || box.tag === "th") && box.whiteSpace === "nowrap") {
			const sw = box.scroll?.sw ?? box.rect?.w ?? 0
			if (r1(sw) > A4_PRINT_INNER_MAX_PX || (box.textLen !== undefined && box.textLen > 95)) {
				defects.push(defect("layout_print_shrink_risk", box.selector, `${box.tag} with white-space: nowrap has ${box.textLen ?? 0} chars (${r1(sw)}px), risking Chromium Print Shrink-to-Fit downscaling`))
			}
		}
	}
	return defects
}

// L9: Gestalt heading proximity inversion — h2/h3 headings whose margin-top is smaller than 1.5x margin-bottom when preceded by another flow sibling.
export function checkHeadingSpacingInversion(boxes) {
	const groups = new Map()
	for (const box of boxes) {
		if (!box.parentSelector || !IN_FLOW.has(box.position)) continue
		const list = groups.get(box.parentSelector) ?? []
		list.push(box)
		groups.set(box.parentSelector, list)
	}
	const defects = []
	for (const siblings of groups.values()) {
		for (let i = 0; i < siblings.length; i += 1) {
			const box = siblings[i]
			if ((box.tag !== "h2" && box.tag !== "h3") || i === 0) continue
			const mt = box.spacing?.mt ?? 0
			const mb = box.spacing?.mb ?? 0
			if (mb > 2 && mt < r1(mb * HEADING_RATIO_MIN)) {
				defects.push(defect("layout_heading_spacing_inversion", box.selector, `${box.tag} has margin-top ${mt}px < 1.5x margin-bottom ${mb}px (Gestalt proximity inversion)`))
			}
		}
	}
	return defects
}
