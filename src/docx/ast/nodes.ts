import type {
  IImageOptions,
  IParagraphOptions,
  IRunOptions,
  ITableCellOptions,
  ITableOptions,
  ITableRowOptions
} from "docx";

export type FileChild = ParagraphNode | TableNode;

export type ParagraphChild = TextRunChild | ImageRunNode;

export type TextRunChild =
  | BreakNode
  | TextRunNode
  | ExternalHyperlinkNode
  | InternalHyperlinkNode
  | BookmarkNode
  | ComplexFieldNode;

export type BreakNode = {
  type: "Break"
}

export type ParagraphNode = {
  type: "Paragraph";
  options: DeepWritable<Omit<IParagraphOptions, "children">>;
  children: ParagraphChild[];
};

export type ImageRunNode = {
  type: "ImageRun";
  options: DeepWritable<Omit<IImageOptions, "data">>;
  data: IImageOptions["data"];
};

export type ExternalHyperlinkNode = {
  type: "ExternalHyperlink";
  options: {
    link: string;
    style?: string;
  };
  children: ParagraphChild[];
};

export type InternalHyperlinkNode = {
  type: "InternalHyperlink";
  options: {
    anchor: string;
    style?: string;
  };
  children: ParagraphChild[];
};

export type BookmarkNode = {
  type: "Bookmark";
  options: {
    id: string;
  };
  children: ParagraphChild[];
};

export type ComplexFieldNode = {
  type: "ComplexField";
  options: {
    instruction: string;
    cached: { text: string };
    style?: string,
  };
};

export type TextRunNode = {
  type: "TextRun";
  options: DeepWritable<Omit<IRunOptions, "children">>;
  children?: TextRunChild[];
};

export type TableNode = {
  type: "Table";
  options: DeepWritable<Omit<ITableOptions, "rows">>;
  children: TableRowNode[];
};

export type TableRowNode = {
  type: "TableRow";
  options: DeepWritable<Omit<ITableRowOptions, "children">>;
  children: TableCellNode[];
};

export type TableCellNode = {
  type: "TableCell";
  options: DeepWritable<Omit<ITableCellOptions, "children">>;
  children: FileChild[];
};

type DeepWritable<T> = { -readonly [P in keyof T]: DeepWritable<T[P]> };

export const isFileChild = (
  node: FileChild | ParagraphChild
): node is FileChild => {
  return node.type == "Paragraph" || node.type == "Table";
};
