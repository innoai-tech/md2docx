import { type Visitors } from "../visitor.ts";
import imageSizeOf from "image-size";
import { set } from "lodash";

export const imageLoadWithMeta = (): Visitors => {
  return {
    async image(c, ctx) {
      if (!c.node.data) {
        if (c.node.url.startsWith("http")) {
          const id = encodeURIComponent(c.node.url);

          let contents: Buffer;

          try {
            contents = Buffer.from((await ctx.fs.load(`.cache/${id}`)).value);
          } catch (err) {
            const b = await fetch(c.node.url).then((c) => c.arrayBuffer());
            contents = Buffer.from(b);
            await ctx.fs.save(`.cache/${id}`, contents);
          }

          c.node.data = {
            type: "Buffer",
            contents: contents
          };
        } else {
          const f = await ctx.fs.load(c.node.url, c.file);

          c.node.data = {
            type: "Buffer",
            contents: Buffer.from(f.value)
          };
        }
      }

      if (c.node.data.contents) {
        set(c.node.data, ["meta"], imageSizeOf(c.node.data.contents));
      }
    }
  };
};
