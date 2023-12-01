import { describe, expect, it } from "bun:test";
import { VFile } from "vfile";
import { process } from "../../visitor.ts";
import { printAST } from "../../printer.ts";
import { tableDirectiveAsChildData } from "../tableDirectiveAsChildData.ts";
import { attrDirectiveAsParentData } from "../attrDirectiveAsParentData.ts";

describe("#tableDirectiveAsChildData", () => {
  it("textDirective should patch parent data", async () => {
    const node = await process(
      new VFile(`
:::table{orientation=portrait}

| x:attr{colspan=2} |  | y |
| ------------------ | - | - |
| 1 | 2 | 3 |
    
:::
`),
      {
        visitors: [tableDirectiveAsChildData(), attrDirectiveAsParentData()],
      },
    );

    expect(printAST(node)).toMatchSnapshot();
  });
});
