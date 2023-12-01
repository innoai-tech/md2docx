import type { VFile } from "vfile";
import type { Root } from "mdast";
import { Collector } from "./Collector.ts";
import { parse } from "@typescript-eslint/parser";
import type { Loader } from "../../markdown/visitors";
import { Cursor, type VisitorContext } from "../../markdown";
import { mdify } from "../../api";

const dts2api = async (typeDefs: string) => {
  return mdify(Collector.from(parse(typeDefs, {
    comment: true,
    loc: true
  })));
};

export * from "./decorators";

export const dts2apiLoader = (): Loader => {
  return {
    test: /\.api\.d\.ts$/,
    async transform(file: VFile, ctx: VisitorContext): Promise<Cursor<Root>> {
      file.value = await dts2api(String(file.value));
      return ctx.parser.parse(file);
    }
  };
};