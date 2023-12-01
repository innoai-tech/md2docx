import { type Visitors } from "../visitor.ts";
import type { Directives } from "mdast-util-directive";

export const tableDirectiveAsChildData = (): Visitors => {
  const toData = (c: Directives) => {
    const { id, class: className, ...props } = c.attributes as any;

    return {
      ...props,
      class: className,
      id,
    };
  };

  return {
    async containerDirective(c, ctx) {
      switch (c.node.name) {
        case "table": {
          const data = toData(c.node);
          const children = [];

          for (const child of c.children()) {
            if (child.node.type == "table") {
              child.patchData(data);
            }
            children.push(child.node);
          }

          c.replaceWith(...children);

          await ctx.visitChildren(c);
        }
      }
    },
  };
};
