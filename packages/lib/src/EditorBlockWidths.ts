import { ADFEntity, ADFEntityMark } from "@atlaskit/adf-utils/types";
import { JSONDocNode } from "@atlaskit/editor-json-transformer";

/**
 * Copy the block widths the Confluence editor applied to an existing page onto
 * the newly generated document.
 *
 * On a full-width page the editor stamps every top-level code block with a
 * breakout mark, every table with a width, and top-level macros with a layout.
 * Markdown cannot express these, so without carrying them each publish narrows
 * the blocks again, and the first publish after any editor save writes a new
 * version even when nothing else changed. The values come from the page itself,
 * following whatever most existing blocks of each kind carry.
 */
export function carryEditorBlockWidths(generated: JSONDocNode, existing: JSONDocNode): JSONDocNode {
	const existingBlocks = existing.content as ADFEntity[];
	const generatedBlocks = generated.content as ADFEntity[];

	const breakout = prevailingValue(
		existingBlocks.filter((node) => node.type === "codeBlock"),
		(node) => node.marks?.find((mark) => mark.type === "breakout"),
	);
	const tableWidth = prevailingValue(
		existingBlocks.filter((node) => node.type === "table"),
		(node) =>
			node.attrs?.["width"] === undefined
				? undefined
				: { width: node.attrs["width"], layout: node.attrs["layout"] },
	);
	const macroLayout = prevailingValue(
		existingBlocks.filter((node) => node.type === "extension"),
		(node) => node.attrs?.["layout"] as string | undefined,
	);

	for (const node of generatedBlocks) {
		if (node.type === "codeBlock" && breakout) {
			node.marks = [
				...(node.marks ?? []).filter((mark) => mark.type !== "breakout"),
				breakout as ADFEntityMark,
			];
		} else if (node.type === "table" && tableWidth) {
			node.attrs = {
				...node.attrs,
				width: tableWidth.width,
				...(tableWidth.layout === undefined ? {} : { layout: tableWidth.layout }),
			};
		} else if (
			node.type === "extension" &&
			macroLayout &&
			node.attrs?.["layout"] === undefined
		) {
			node.attrs = { ...node.attrs, layout: macroLayout };
		}
	}
	return generated;
}

/** The value most nodes produce (undefined when most carry none); ties go to the first seen. */
function prevailingValue<T>(
	nodes: ADFEntity[],
	valueOf: (node: ADFEntity) => T | undefined,
): T | undefined {
	const counts = new Map<string, { value: T | undefined; count: number }>();
	for (const node of nodes) {
		const value = valueOf(node);
		const key = value === undefined ? "" : JSON.stringify(value);
		const entry = counts.get(key) ?? { value, count: 0 };
		entry.count++;
		counts.set(key, entry);
	}
	let best: { value: T | undefined; count: number } | undefined;
	for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
	return best?.value;
}
