import { Cursor } from "../../markdown";
import type { Loader } from "../../markdown/visitors";
import type { Image, Root } from "mdast";

export const mermaid2imgLoader = ({
                                    krokiEndpoint = process.env["KROKI_ENDPOINT"] ?? "https://kroki.io"
                                  }: {
  krokiEndpoint?: string;
}): Loader => {
  return {
    test: /\.(mmd|mermaid)$/,
    async transform(f, _) {
      const ret = await fetch(`${krokiEndpoint}/mermaid/png`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain"
        },
        body: String(f.value)
      });

      f.value = Buffer.from(await ret.arrayBuffer());

      return Cursor.of<Root>(
        {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "image",
                  url: f.path,
                  data: {
                    type: "Buffer",
                    contents: f.value
                  }
                } as Image
              ]
            }
          ]
        },
        {
          file: f
        }
      );
    }
  };
};
