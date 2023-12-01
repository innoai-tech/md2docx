import { describe, expect, it } from "bun:test";
import { VFile } from "vfile";
import { process } from "../../visitor.ts";
import { printAST } from "../../printer.ts";
import { captionDirectiveAsParagraph } from "../captionDirectiveAsParagraph.ts";

describe("#captionDirectiveAsParagraph", () => {
  it("leafDirective should convert as paragraph", async () => {
    const node = await process(
      new VFile(`
::caption[我是表格]{#table-x type=Table}
`),
      {
        visitors: [captionDirectiveAsParagraph()],
      },
    );

    expect(printAST(node)).toMatchSnapshot();
  });

  it("textDirective should patch parent data", async () => {
    const node = await process(
      new VFile(`
我是表格:caption{#table-x type=Table}
`),
      {
        visitors: [captionDirectiveAsParagraph()],
      },
    );

    expect(printAST(node)).toMatchSnapshot();
  });
});
