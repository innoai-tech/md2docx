import type {
  Root,
  DefinitionContent,
  PhrasingContent,
  BlockContent,
  RootContent,
} from "mdast";
import type { VFile } from "vfile";
import { parse } from "./markdown.ts";
import { Cursor } from "./Cursor.ts";
import type { FS } from "../fs";
import { OsFS } from "../fs";

export type Exactly<Union, Type> = Union extends { type: Type } ? Union : never;

export type MdastNode =
  | RootContent
  | BlockContent
  | PhrasingContent
  | DefinitionContent;

export type Visitors = {
  [K in MdastNode["type"]]?: (
    c: Cursor<Exactly<MdastNode, K>>,
    ctx: VisitorContext,
  ) => Promise<void>;
};

export type VisitorContext = {
  fs: FS;
  parser: Parser;
  visitChildren(c: Cursor, options?: ProcessOptions): Promise<void>;
};

export type ProcessOptions = {
  fs?: FS;
  visitors?: Visitors[];
};

export interface Parser {
  parse: (f: VFile) => Cursor<Root>;
}

export const process = async (
  file: VFile,
  options: ProcessOptions,
): Promise<Root> => {
  const w = new Context(
    {
      parse: (file) => {
        return Cursor.of(parse(file.value), { file });
      },
    },
    options.fs ?? new OsFS(),
    options.visitors ?? [],
  );

  const root = w.parser.parse(file);
  await w.visitChildren(root);
  return root.node;
};

class Context implements VisitorContext {
  constructor(
    public parser: Parser,
    public fs: FS,
    protected visitors: Visitors[],
  ) {}

  async visitChildren(c: Cursor, options: ProcessOptions = {}): Promise<void> {
    for (const child of c.children()) {
      for (const v of [...this.visitors, ...(options.visitors ?? [])]) {
        const visitor = (v as any)[child.node.type];

        if (!visitor) {
          await this.visitChildren(child);
          continue;
        }

        await visitor(child, this);
      }
    }
  }
}
