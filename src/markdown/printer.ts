import { type Root } from "mdast";
import { isBuffer, isNull, isUndefined, map, repeat } from "lodash";

export const printAST = (root: Root): string => {
  const print = (root: Root, depth = 0) => {
    const {
      position: _0,
      children: _1,
      type: _3,
      data,
      attributes,
      ...props
    } = root as any;

    const attrsStr = map({ ...data, ...props, ...attributes }, (v, k) => {
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
        ?.map((c) => {
          return `${repeat("  ", depth + 1)}${print(c as any, depth + 1)}`;
        })
        .join("\n") ?? "";

    return `${root.type}${attrsStr ? `{${attrsStr}}` : ""}${
      childrenStr ? `\n${childrenStr}` : ""
    }`;
  };

  return print(root);
};
