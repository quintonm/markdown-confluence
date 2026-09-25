import type MarkdownIt from "markdown-it";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import { markdownItTable } from "markdown-it-table";

type BlockRuleEntry = {
	name: string;
	fn: RuleBlock;
};

type BlockRulerWithEntries = MarkdownIt["block"]["ruler"] & {
	// markdown-it does not expose a public way to address a duplicate-named rule.
	// markdown-it-table adds a second "table" rule alongside markdown-it's disabled
	// built-in rule, so identify the new entry by object identity.
	__rules__?: BlockRuleEntry[];
};

/**
 * Install markdown-it-table without allowing its cell parser to leak lineMax.
 *
 * markdown-it-table 4.1.1 sets StateBlock.lineMax to 1 while parsing every
 * table cell and does not restore it. After the first table, repeated blank
 * lines can consequently become empty paragraphs or setext headings. Preserve
 * the outer document boundary around each invocation of the plugin rule.
 */
export function stableMarkdownItTable(md: MarkdownIt): void {
	const ruler = md.block.ruler as BlockRulerWithEntries;
	const entriesBefore = new Set(ruler.__rules__ ?? []);
	markdownItTable(md, {});

	let entry: BlockRuleEntry | undefined;
	for (const candidate of ruler.__rules__ ?? []) {
		if (candidate.name === "table" && !entriesBefore.has(candidate)) entry = candidate;
	}
	if (!entry) throw new Error("markdown-it-table did not register its block rule");

	const tableRule = entry.fn;
	entry.fn = (state, startLine, endLine, silent) => {
		const lineMax = state.lineMax;
		try {
			return tableRule(state, startLine, endLine, silent);
		} finally {
			state.lineMax = lineMax;
		}
	};
}
