import { type Visitors } from "../visitor.ts";
import { mapKeys } from "lodash";
import type { Paragraph } from "mdast";
import type { Directives } from "mdast-util-directive";

export const captionDirectiveAsParagraph = (): Visitors => {
  const toData = (c: Directives) => {
    const { id, class: className, ...props } = c.attributes as any;

    return {
      ...mapKeys(props, (_, key) => `caption-${key}`),
      class: className,
      id,
    };
  };

  return {
    async textDirective(c, _) {
      switch (c.node.name) {
        case "caption": {
          if (c.parent) {
            c.parent.patchData(toData(c.node));
            c.remove();
          }
        }
      }
    },
    async leafDirective(c, _) {
      switch (c.node.name) {
        case "caption": {
          c.replaceWith({
            type: "paragraph",
            data: toData(c.node),
            children: c.node.children,
          } as Paragraph);
        }
      }
      return;
    },
  };
};
