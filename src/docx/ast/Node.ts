import {
  type ParagraphChild as DocxParagraphChild,
  type ISectionOptions,
  type IRunOptions,
  Bookmark,
  ExternalHyperlink,
  ImageRun,
  InternalHyperlink,
  Paragraph,
  Run,
  Table,
  TableCell,
  TableRow,
  TextRun,
  XmlComponent
} from "docx";
import {
  FldCharBegin,
  FldCharEnd,
  FldCharSeparate,
  InstrText
} from "./ComplexField.ts";

export type DocxTextRunChild = Required<IRunOptions>["children"][0] | XmlComponent;

import type {
  BookmarkNode,
  TextRunNode,
  ImageRunNode,
  ExternalHyperlinkNode,
  InternalHyperlinkNode,
  ComplexFieldNode,
  ParagraphChild,
  FileChild,
  ParagraphNode,
  TableNode,
  BreakNode
} from "./nodes.ts";

class Break extends XmlComponent {
  constructor() {
    super("w:br");
  }
}

export class Converter {
  static paragraphChild(...children: ParagraphChild[]): DocxParagraphChild[] {
    const ret: DocxParagraphChild[] = [];
    for (const c of children) {
      const convert = converters[c.type];

      if (convert) {
        for (const child of convert(c as any, Converter)) {
          ret.push(child);
        }
      } else {
        console.error(`[docx] unsupported ${c.type}`);
      }
    }

    return ret;
  }

  static fileChild(...children: FileChild[]): DocxFileChild[] {
    const ret: DocxFileChild[] = [];

    for (const c of children) {
      const convert = converters[c.type];

      if (convert) {
        for (const child of convert(c as any, Converter)) {
          ret.push(child);
        }
      } else {
        console.error(`unsupported ${c.type}`);
      }
    }

    return ret;
  }
}

type DocxFileChild = ISectionOptions["children"][0];

export interface ConvertContext {
  fileChild(...children: FileChild[]): DocxFileChild[];

  paragraphChild(...children: ParagraphChild[]): DocxParagraphChild[];
}

type Exactly<Union, Type> = Union extends { type: Type } ? Union : never;

export type Converters = {
  [K in ParagraphChild["type"]]: (
    node: Exactly<ParagraphChild, K>,
    ctx: ConvertContext
  ) => Iterable<DocxParagraphChild>;
} & {
  [K in FileChild["type"]]: (
    node: Exactly<FileChild, K>,
    ctx: ConvertContext
  ) => Iterable<DocxFileChild>;
};

export const converters: Converters = {
  * Break(_: BreakNode, _1: ConvertContext): Iterable<any> {
    return new Break();
  },

  * Paragraph(c: ParagraphNode, ctx: ConvertContext): Iterable<Paragraph> {
    yield new Paragraph({
      ...c.options,
      children: ctx.paragraphChild(...c.children)!
    });

    return;
  },

  * Table(c: TableNode, ctx: ConvertContext): Iterable<Table> {
    yield new Table({
      ...c.options,
      rows: c.children.map((row) => {
        return new TableRow({
          ...row.options,
          children: row.children.map((cell) => {
            return new TableCell({
              ...cell.options,
              children: ctx.fileChild(...cell.children)
            });
          })
        });
      })
    });

    return;
  },

  * TextRun(c: TextRunNode, ctx: ConvertContext): Iterable<TextRun> {
    yield new TextRun({
      ...c.options,
      children: c.children
        ? (ctx.paragraphChild(...c.children) as any)
        : undefined
    });
    return;
  },

  * ImageRun(c: ImageRunNode, _: ConvertContext): Iterable<ImageRun> {
    yield new ImageRun({
      ...c.options,
      data: c.data
    });
    return;
  },

  * ExternalHyperlink(
    c: ExternalHyperlinkNode,
    ctx: ConvertContext
  ): Iterable<ExternalHyperlink> {
    yield new ExternalHyperlink({
      link: c.options.link,
      children: ctx.paragraphChild(...c.children)
    });

    return;
  },

  * InternalHyperlink(
    c: InternalHyperlinkNode,
    ctx: ConvertContext
  ): Iterable<InternalHyperlink> {
    yield new InternalHyperlink({
      anchor: c.options.anchor,
      children: ctx.paragraphChild(...c.children)
    });
    return;
  },

  * Bookmark(c: BookmarkNode, ctx: ConvertContext): Iterable<Bookmark> {
    yield new Bookmark({
      id: c.options.id,
      children: ctx.paragraphChild(...c.children)!
    });

    return;
  },

  * ComplexField(
    c: ComplexFieldNode,
    _: ConvertContext
  ): Iterable<XmlComponent> {
    const { instruction, cached, ...others } = c.options;

    yield new Run({
      ...others,
      children: [new FldCharBegin()]
    });

    yield new Run({
      ...others,
      children: [new InstrText(instruction)]
    });

    yield new Run({
      ...others,
      children: [new FldCharSeparate()]
    });

    yield new TextRun({
      ...others,
      text: cached.text
    });

    yield new Run({
      ...others,
      children: [new FldCharEnd()]
    });

    return;
  }
};
