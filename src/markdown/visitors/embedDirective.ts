import { type VisitorContext, type Visitors } from "../visitor.ts";
import { VFile } from "vfile";
import { isUndefined } from "lodash";
import { Cursor } from "../Cursor.ts";
import type { Root } from "mdast";

export interface Loader {
  test: RegExp;

  transform(file: VFile, ctx: VisitorContext): Promise<Cursor<Root>>;
}

export const defaultLoaders: Loader[] = [
  {
    test: /\.md$/,
    transform: async (file, ctx) => {
      return ctx.parser.parse(
        new VFile({
          path: file.path,
          cwd: file.cwd,
          value: file.value
        })
      );
    }
  }
];

const normalizeHeadingDepth = (headingDepthStarts: number): Visitors => {
  let delta: number;

  return {
    async heading(c, _) {
      if (isUndefined(delta)) {
        delta = headingDepthStarts - c.node.depth + 1;
      }
      c.node.depth += delta;
    }
  };
};

export const embedDirective = ({
                                 loaders = defaultLoaders
                               }: {
  loaders?: Loader[];
}): Visitors => {
  let headingDepth: number | null = null;

  return {
    async heading(c, ctx) {
      headingDepth = c.node.depth;
      await ctx.visitChildren(c);
    },

    async thematicBreak(c, ctx) {
      headingDepth = null;
      await ctx.visitChildren(c);
    },

    async leafDirective(c, ctx) {
      switch (c.node.name) {
        case "embed": {
          const url = c.node.attributes!["url"]!;
          const inHeading = c.node.attributes!["inHeading"];

          for (const loader of loaders) {
            if (loader.test.test(url)) {
              const subRoot: Cursor<Root> = await loader.transform(
                await ctx.fs.load(url, c.file),
                ctx
              );

              await ctx.visitChildren(subRoot, {
                visitors: [
                  normalizeHeadingDepth(inHeading ? parseInt(inHeading) : headingDepth ?? 0)
                ]
              });

              c.replaceWith(...subRoot.node.children);
            }
          }
        }
      }
    }
  };
};
