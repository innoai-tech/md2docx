import { describe, expect, it } from "bun:test";
import { VFile } from "vfile";
import { process } from "../../visitor.ts";
import { printAST } from "../../printer.ts";
import { attrDirectiveAsParentData } from "../attrDirectiveAsParentData.ts";

describe("#attrDirectiveAsParentData", () => {
  it("textDirective should patch parent data", async () => {
    const node = await process(
      new VFile(`
# 一级标题:attr{#h1}
`),
      {
        visitors: [attrDirectiveAsParentData()],
      },
    );

    expect(printAST(node)).toMatchSnapshot();
  });
});
