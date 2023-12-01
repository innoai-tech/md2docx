import { type Visitors } from "../visitor.ts";
import type { Directives } from "mdast-util-directive";

export const attrDirectiveAsParentData = (): Visitors => {
  const toData = (c: Directives) => {
    const { id, class: className, ...props } = c.attributes as any;

    return {
      ...props,
      class: className,
      id,
    };
  };

  return {
    async textDirective(c, _) {
      switch (c.node.name) {
        case "attr": {
          if (c.parent) {
            c.parent.patchData(toData(c.node));
            c.remove();
          }
        }
      }
    },
  };
};
