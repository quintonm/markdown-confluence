import { expect, test } from "@effect/vitest";
import { ADFEntity } from "@atlaskit/adf-utils/types";
import { JSONDocNode } from "@atlaskit/editor-json-transformer";
import { carryEditorBlockWidths } from "./EditorBlockWidths";

const wide = { type: "breakout", attrs: { mode: "wide", width: 1800 } };

function doc(...content: ADFEntity[]): JSONDocNode {
	return { type: "doc", version: 1, content } as JSONDocNode;
}
function code(text: string, marks?: unknown[]): ADFEntity {
	return {
		type: "codeBlock",
		...(marks ? { marks } : {}),
		content: [{ type: "text", text }],
	} as ADFEntity;
}
function table(attrs?: Record<string, unknown>): ADFEntity {
	return { type: "table", ...(attrs ? { attrs } : {}), content: [] };
}
function toc(attrs: Record<string, unknown>): ADFEntity {
	return {
		type: "extension",
		attrs: {
			extensionType: "com.atlassian.confluence.macro.core",
			extensionKey: "toc",
			...attrs,
		},
	};
}

test("stamps generated code blocks and tables with the widths the editor applied", () => {
	const existing = doc(
		code("old", [wide]),
		table({ layout: "default", width: 1800, localId: "abc" }),
	);
	const generated = doc(code("new one"), code("new two"), table());

	carryEditorBlockWidths(generated, existing);

	expect(generated.content.map((node) => node.marks)).toEqual([[wide], [wide], undefined]);
	expect(generated.content[2]?.attrs).toEqual({ layout: "default", width: 1800 });
});

test("follows the width most existing blocks carry", () => {
	const existing = doc(code("a", [wide]), code("b", [wide]), code("c"));
	const generated = doc(code("x"));

	carryEditorBlockWidths(generated, existing);

	expect(generated.content[0]?.marks).toEqual([wide]);
});

test("leaves blocks alone when the existing page has no editor widths", () => {
	const generated = doc(code("x"), table());

	carryEditorBlockWidths(generated, doc(code("a"), table()));

	expect(generated).toEqual(doc(code("x"), table()));
});

test("carries the layout the editor applied to top-level macros", () => {
	const generated = doc(toc({}));

	carryEditorBlockWidths(generated, doc(toc({ layout: "default" })));

	expect(generated.content[0]?.attrs?.["layout"]).toBe("default");
});
