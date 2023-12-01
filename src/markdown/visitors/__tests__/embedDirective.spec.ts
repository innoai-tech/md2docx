import { describe, expect, it } from "bun:test";
import { VFile } from "vfile";
import { process } from "../../visitor.ts";
import { printAST } from "../../printer.ts";
import { embedDirective } from "../embedDirective.ts";
import { MemFS } from "../../../fs";

describe("#embedDirective", () => {
  it("leafDirective should replaced with embeded", async () => {
    const node = await process(
      new VFile(
        `
# 一级标题

::embed{url=./sub.md}
`,
      ),
      {
        fs: new MemFS({
          "sub.md": `
# 标题

内容内容
`,
        }),
        visitors: [embedDirective({})],
      },
    );

    expect(printAST(node)).toMatchSnapshot();
  });
});
