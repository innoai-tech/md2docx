import { gql } from "graphql-tag";
import { Collector } from "./Collector.ts";
import type { Loader } from "../../markdown/visitors";
import type { VFile } from "vfile";
import type { VisitorContext } from "../../markdown";
import { Cursor } from "../../markdown";
import type { Root } from "mdast";
import { mdify } from "../../api";

export const gql2ApiMd = (typeDefs: string) => {
  return mdify(Collector.from(gql(typeDefs)));
};

export const gql2apiLoader = (): Loader => {
  return {
    test: /\.api\.gql$/,
    async transform(file: VFile, ctx: VisitorContext): Promise<Cursor<Root>> {
      file.value = gql2ApiMd(String(file.value));
      return ctx.parser.parse(file);
    }
  };
};
