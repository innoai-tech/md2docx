import { Cursor, type Exactly, type MdastNode } from "../markdown";
import { AlignmentType, HeadingLevel, UniversalMeasure, WidthType } from "docx";
import {
  type FileChild,
  type ParagraphChild,
  type BookmarkNode,
  type ComplexFieldNode,
  rotateTable,
  Doc,
  type TextRunChild,
  type InternalHyperlinkNode,
  type ExternalHyperlinkNode,
  type TableNode,
  type TableRowNode,
  type TableCellNode,
  type ParagraphNode,
  isFileChild,
  Section,
  type Contracts,
  normalizeAsEMU,
  Unit
} from "../docx";
import { get, isNull, isString, merge, parseInt, size } from "lodash";
import * as Buffer from "buffer";
import { children } from "cheerio/lib/api/traversing";
import type { Handlers } from "mdast-util-to-markdown";

export const toDocx = async (
  root: Cursor,
  {
    configRAW
  }: {
    configRAW: string;
  }
) => {
  return await State.convert(root, {
    configRAW,
    handlers: handlers as any
  });
};

type Handlers = Partial<{
  [K in MdastNode["type"]]: ((
    c: Cursor<Exactly<MdastNode, K>>,
    ctx: {
      state: State;
      contracts: Contracts;
    } & {
      [k: string]: any;
    }
  ) => Iterable<FileChild | ParagraphChild>) ;
}>;

const handlers = {
  * textDirective(c, ctx): Iterable<ParagraphChild> {
    switch (c.node.name) {
      case "sub":
        yield  {
          type: "TextRun",
          options: {
            subScript: true
          },
          children: [...ctx.state.children(c, ctx)] as TextRunChild[]
        };
        break;
      case "sup":
        yield  {
          type: "TextRun",
          options: {
            superScript: true
          },
          children: [...ctx.state.children(c, ctx)] as TextRunChild[]
        };
        break;
      default:
        console.log(`unsupported textDirective: ${c.node.name}`);
    }
  },
  * html(c, _): Iterable<ParagraphChild> {
    switch (c.node.value) {
      case "<br>":
        yield  {
          type: "Break"
        };
        break;
      default:
        console.log(`unsupported html: ${c.node.value}`);
    }
  },
  * image(c, ctx): Iterable<FileChild> {
    // 9525 from source of docx.js

    const size = {
      width: normalizeAsEMU(`${c.node.data?.meta?.width ?? 10}pt` as UniversalMeasure) / 9525,
      height: normalizeAsEMU(`${c.node.data?.meta?.height ?? 10}pt` as UniversalMeasure) / 9525
    };

    const transformation = imageTransform(size, {
      width: ctx.contracts.inner.width / 9525
    });

    yield {
      type: "Paragraph",
      options: {
        alignment: AlignmentType.CENTER
      },
      children: [
        {
          type: "ImageRun",
          data: c.node.data?.contents as Buffer,
          options: {
            transformation: transformation
          }
        }
      ]
    } as  ParagraphNode;
  },
  * listItem(c, ctx) {
    const subLists: FileChild[] = [];
    const children: ParagraphChild[] = [];

    for (const p of c.children()) {
      for (const e of p.children()) {
        for (const c of ctx.state.iter(e, {
          ...ctx,
          level: get(ctx, "level", -1) + 1
        })) {
          if (isFileChild(c)) {
            subLists.push(c);
            continue;
          }
          children.push(c);
        }
      }
    }

    if (get(ctx, "ordered")) {
      yield {
        type: "Paragraph",
        options: {
          numbering: ctx.state.doc.config?.numbering?.["list"]
            ? {
              reference: "numbering:list",
              level: get(ctx, "level", 0),
              instance: ctx.state.numberingInstance.list
            }
            : undefined
        },
        children: children
      } as ParagraphNode;
    } else {
      yield {
        type: "Paragraph",
        options: {
          bullet: {
            level: get(ctx, "level", 0)
          },
          numbering: ctx.state.doc.config?.numbering?.["bullet"]
            ? {
              reference: "numbering:bullet",
              level: get(ctx, "level", 0)
            }
            : undefined
        },
        children: children
      } as ParagraphNode;
    }

    for (const item of subLists) {
      yield item;
    }
  },
  * list(c, ctx) {
    for (const listItem of c.children()) {
      yield* ctx.state.iter(listItem, {
        ...ctx,
        level: get(ctx, "level", -1) + 1,
        ordered: !!c.node.ordered
      });
    }
  },

  * table(c, ctx) {
    let tableNode: TableNode = {
      type: "Table",
      options: {},
      children: []
    };

    for (const row of c.children()) {
      const rowNode: TableRowNode = {
        type: "TableRow",
        options: {},
        children: []
      };

      for (const cell of row.children()) {
        const parseSpan = (v?:string) => {

          if (isString(v)) {
            return parseInt(v)
          }

          return 1
        }

        const cellNode: TableCellNode = {
          type: "TableCell",
          options: {
            rowSpan: parseSpan(cell.node.data?.["rowspan"]),
            columnSpan: parseSpan(cell.node.data?.["colspan"])
          },
          children: []
        };

        const paragraphs: FileChild[] = [];
        const children: ParagraphChild[] = [];

        for (const e of cell.children()) {
          for (const c of ctx.state.iter(e, ctx)) {
            if (isFileChild(c)) {
              paragraphs.push(c);
              continue;
            }
            children.push(c);
          }
        }

        cellNode.children = [
          ...paragraphs,
          ...(children.length
            ? [
              {
                type: "Paragraph",
                options: {},
                children: children
              } as ParagraphNode
            ]
            : [])
        ];

        rowNode.children.push(cellNode);
      }

      tableNode.children.push(rowNode);
    }

    const tableAttrs = (c.node.data ?? {}) as {
      orientation?: "portrait" | "landscape";
    };

    const landscape = tableAttrs.orientation == "landscape";
    const noHeader = landscape;

    if (landscape) {
      tableNode = rotateTable(tableNode);
    }

    const tableStyleName = "normalTable";

    const tableStyle = ctx.state.doc.getFullStyle(tableStyleName)?.table;

    Object.assign(tableNode.options, {
      ...(tableStyle ?? {}),
      width: {
        type: WidthType.DXA,
        size: ctx.contracts.inner.width / Unit.DXA
      },
      style: tableStyleName
    });

    tableNode.children.forEach((row, i) => {
      const tableHeader = !noHeader && i == 0;

      row.options.tableHeader = tableHeader;

      row.children.forEach((cell, j) => {
        const tableCellHeader = tableHeader || (landscape && j == 0);

        cell.options.width = landscape
          ? {
            type: WidthType.PERCENTAGE,
            size:
              j == 0
                ? 1 / (cell.children.length * 3)
                : 3 / (cell.children.length * 3)
          }
          : {
            type: WidthType.PERCENTAGE,
            size: 1 / cell.children.length
          };

        Object.assign(
          cell.options,
          tableCellHeader
            ? merge({}, tableStyle?.cell, tableStyle?.style?.firstRow?.cell)
            : tableStyle?.cell
        );

        cell.children.forEach((p) => {
          if (p.type == "Paragraph") {
            p.options.style = tableCellHeader
              ? `${tableStyleName}HeaderContents`
              : `${tableStyleName}Contents`;
          }
        });
      });
    });

    yield tableNode;
  },

  * link(c, ctx) {
    if (c.node.url.startsWith("#")) {
      const id = c.node.url.slice(1);

      const children = [...ctx.state.children(c, ctx)] as ParagraphChild[];

      const cf = {
        type: "ComplexField",
        options: {
          instruction: `REF ${id} \\h`,
          cached: ctx.state.resolveBookmarkTextRef(id)
        }
      } as ComplexFieldNode;

      const isSingleTextRunChild = children.length == 1 && children[0]!.type == "TextRun";

      // WPS must InternalHyperlink as the root wrapper
      yield {
        type: "InternalHyperlink",
        options: {
          anchor: id
        },
        children: [
          isSingleTextRunChild ? {
            ...children[0],
            options: {
              ...get(children[0], "options", {}),
              style: "hyperlink"
            },
            children: [
              {
                ...cf,
                options: {
                  ...get(children[0], "options", {}),
                  ...cf.options
                }
              }
            ]
          } : cf
        ]
      } as InternalHyperlinkNode;
      return;
    }

    yield {
      type: "ExternalHyperlink",
      options: {
        link: c.node.url
      },
      children: [
        ...ctx.state.children(c, ctx)
      ]
    } as ExternalHyperlinkNode;
  },

  * strong(c, ctx) {
    yield {
      type: "TextRun",
      options: {
        bold: true
      },
      children: [...ctx.state.children(c, ctx)] as TextRunChild[]
    };
  },

  * text(c, _) {
    yield {
      type: "TextRun",
      options: {
        text: c.node.value
      }
    };
  },

  * inlineCode(c, _) {
    yield {
      type: "TextRun",
      options: {
        text: c.node.value,
        style: "inlineCode"
      }
    };
  },

  * code(c, _) {
    yield {
      type: "Paragraph",
      options: {
        style: "codeBlock"
      },
      children: [
        ...c.node.value.split("\n").map((l) => {
          return {
            type: "TextRun",
            options: {
              break: 1,
              text: l
            }
          };
        })
      ]
    } as ParagraphNode;
  },

  * paragraph(c, ctx) {
    if (c.node.children.length) {
      const children: ParagraphChild[] = [];

      for (const child of ctx.state.children(c, ctx)) {
        if (isFileChild(child)) {
          yield child;
          continue;
        }
        children.push(child);
      }

      if (get(c.node.data, ["caption-type"])) {
        const captionType = get(c.node.data, ["caption-type"]);

        yield {
          type: "Paragraph",
          options: {
            style: "caption"
          },
          children: ctx.state.mayWrapSequentialIdentifierBookmark(
            children,
            captionType,
            get(c.node.data, ["id"])
          )
        };

        return;
      }

      if (children.length) {
        yield {
          type: "Paragraph",
          options: {
            style: "normalIndent"
          },
          children: [...ctx.state.children(c, ctx)] as ParagraphChild[]
        };
      }
    }
  },

  * heading(c, ctx) {
    // when heading will create listInstance
    ctx.state.numberingInstance.list++;

    if (c.node.depth == 1) {
      ctx.state.numberingInstance.heading++;

      yield {
        type: "Paragraph",
        options: {
          heading: HeadingLevel.TITLE
        },
        children: [...ctx.state.children(c, ctx)] as ParagraphChild[]
      };
    } else {
      const level = c.node.depth - 2;

      yield {
        type: "Paragraph",
        options: {
          heading: [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6
          ][level],
          numbering: ctx.state.doc.config?.numbering?.["heading"]
            ? {
              reference: "numbering:heading",
              instance: ctx.state.numberingInstance.heading,
              level: level
            }
            : undefined
        },
        children: [...ctx.state.children(c, ctx)] as ParagraphChild[]
      };
    }
  }
};

class State {
  static async convert(
    c: Cursor,
    { configRAW, handlers }: { configRAW: string; handlers: Handlers }
  ): Promise<Doc> {
    const state = new State(Doc.create(configRAW), handlers);

    await state.scan(c);

    return state.doc;
  }

  constructor(
    public doc: Doc,
    protected handlers: Handlers
  ) {
  }

  numberingInstance = {
    heading: 0,
    list: 0
  };

  * children(
    c: Cursor,
    ctx: {
      state: State;
      contracts: Contracts;
      [k: string]: any;
    }
  ): Iterable<FileChild | ParagraphChild> {
    for (const child of c.children()) {
      yield* this.iter(child, {
        ...ctx,
        state: this
      });
    }
  }

  * iter(
    c: Cursor,
    ctx: { state: State; contracts: Contracts; [k: string]: any }
  ) {
    const h = get(this.handlers, c.node.type);
    if (h) {
      yield* h(c, {
        ...ctx,
        state: this
      });
    } else {
      console.log(`${c.node.type} is not unsupported.`);
    }
  }

  private async scan(root: Cursor) {
    let currentSection: Section | null = null;

    for (const c of root.children()) {
      if (c.isToml()) {
        currentSection = this.doc.createSection(c.node.value);
        continue;
      }

      if (isNull(currentSection)) {
        currentSection = this.doc.createSection("");
      }

      for (const node of this.iter(c, {
        state: this,
        contracts: currentSection.contracts()
      })) {
        if (node.type == "Paragraph" || node.type == "Table") {
          currentSection.add(node);
          continue;
        }
        console.error(
          "SectionNode could ParagraphChild should not add to ",
          node
        );
      }
    }
  }

  bookmarkTextNodes = new Map<string, { text: string }>();

  seqIds: Record<SequentialType, number> = {
    Table: 0,
    Figure: 1,
    Equation: 1
  };

  resolveBookmarkTextRef(id: string) {
    if (!this.bookmarkTextNodes.has(id)) {
      this.bookmarkTextNodes.set(id, {
        text: ""
      });
    }
    return this.bookmarkTextNodes.get(id)!;
  }

  mayWrapSequentialIdentifierBookmark = (
    children: ParagraphChild[],
    type: SequentialType,
    id?: string
  ): ParagraphChild[] => {
    if (id) {
      const textRef = this.resolveBookmarkTextRef(id);

      this.seqIds[type]++;

      textRef.text = `${
        {
          Table: "表",
          Figure: "图",
          Equation: "公式"
        }[type]
      } ${this.seqIds[type]}`;

      if (!textRef.text) {
        throw new Error(`unsupported caption type ${type}`);
      }

      return [
        {
          type: "Bookmark",
          options: {
            id: id
          },
          children: [
            {
              type: "ComplexField",
              options: {
                instruction: `SEQ ${type}`,
                cached: textRef
              }
            } as ComplexFieldNode
          ]
        } as BookmarkNode,
        {
          type: "TextRun",
          options: {
            text: `. `
          }
        },
        ...children
      ];
    }

    return children;
  };
}

type SequentialType = "Table" | "Figure" | "Equation";

function imageTransform(
  size: { width: number; height: number },
  max: { width: number }
) {
  if (size.width <= max.width) {
    return {
      width: size.width,
      height: size.height
    };
  }

  const scale = max.width / size.width;

  return {
    width: max.width,
    height: size.height * scale
  };
}
