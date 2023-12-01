import type {
  ISectionPropertiesOptions,
  ILevelsOptions,
  IParagraphStylePropertiesOptions,
  IRunStylePropertiesOptions,
  ITableCellOptions,
  IBaseParagraphStyleOptions,
} from "docx";
import { TableLayoutType } from "docx";

export type IndentValueOfCharsValue<
  Options = IParagraphStylePropertiesOptions["indent"],
> = {
  [K in keyof Options]: Options[K];
} & {
  [K in keyof Options as K extends string ? `${K}Chars` : never]: number;
};

export type ParagraphStyle = DeepWritable<
  Omit<IParagraphStylePropertiesOptions, "indent">
> & {
  indent?: IndentValueOfCharsValue;
};

export interface Style
  extends DeepWritable<Omit<IBaseParagraphStyleOptions, "run" | "paragraph">> {
  run?: DeepWritable<IRunStylePropertiesOptions>;
  paragraph?: ParagraphStyle;
  table?: TableStyle;
}

export interface TableStyle {
  layout?: TableLayoutType;
  cell?: TableCellStyle;
  style?: Record<string, { cell?: TableCellStyle }> & {
    firstRow?: { cell?: TableCellStyle };
  };
}

export interface TableCellStyle
  extends DeepWritable<Omit<ITableCellOptions, "children">> {
  run?: DeepWritable<IRunStylePropertiesOptions>;
  paragraph?: ParagraphStyle;
}

export interface Numbering {
  levels: Array<Omit<DeepWritable<ILevelsOptions>, "level">>;
}

export interface Config extends DeepWritable<ISectionPropertiesOptions> {
  style?: Record<string, Style>;
  numbering?: Record<string, Numbering>;
}

type DeepWritable<T> = { -readonly [P in keyof T]: DeepWritable<T[P]> };
