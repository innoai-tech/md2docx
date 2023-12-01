import { isBuffer, isNull, isUndefined, map, repeat } from "lodash";
import type { FileChild } from "./nodes.ts";

export const printAST = (children: FileChild[]): string => {
  const print = (root: any, depth = 0) => {
    const { children: _1, type: _2, data: _3, options } = root as any;

    const attrsStr = map(options, (v, k) => {
      if (isNull(v) || isUndefined(v)) {
        return "";
      }
      if (isBuffer(v)) {
        return `${k}=[Buffer]`;
      }

      return `${k}=${JSON.stringify(v)}`;
    })
      .filter((v) => v)
      .sort()
      .join(",");

    const childrenStr: string =
      root.children
        ?.map((c: any) => {
          return `${repeat("  ", depth + 1)}${print(c as any, depth + 1)}`;
        })
        .join("\n") ?? "";

    return `${root.type}${attrsStr ? `{${attrsStr}}` : ""}${
      childrenStr ? `\n${childrenStr}` : ""
    }`;
  };

  return children.map((c) => print(c)).join("\n");
};
