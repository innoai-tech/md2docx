import type { Config, Style } from "./Config.ts";
import {
  Packer,
  Document as File,
  type ISectionOptions,
  type INumberingOptions,
  type IStylesOptions,
  type UniversalMeasure,
  PageOrientation,
  type PositiveUniversalMeasure,
  type IParagraphStylePropertiesOptions,
  LevelFormat,
  LevelSuffix
} from "docx";
import JSZIP from "jszip";
import {
  upperFirst,
  cloneDeepWith,
  get,
  isNumber,
  isString,
  map,
  mapValues,
  merge,
  omit,
  partition,
  forEach,
  isUndefined
} from "lodash";
import type { FileChild } from "./ast";
import { Converter } from "./ast";
import { type Cheerio, load } from "cheerio";

export enum Unit {
  EMU = 1,
  PT = 12700 * EMU,
  HALF_PT = PT / 2,
  DXA = PT / 20,
  INCHES = 914400 * EMU,
  MM = 36000 * EMU,
  CM = 360000 * EMU,
}

export const normalizeAsEMU = (val: number | UniversalMeasure): number => {
  if (isNumber(val)) {
    return val;
  }
  if (isString(val)) {
    const unit = val.slice(-2);
    const amount = Number(val.substring(0, val.length - 2));

    // https://startbigthinksmall.wordpress.com/2010/01/04/points-inches-and-emus-measuring-units-in-office-open-xml/
    switch (unit) {
      case "pt":
        return Math.round(amount * Unit.PT);
      case "mm":
        return Math.round(amount * Unit.MM);
      case "cm":
        return Math.round(amount * Unit.CM);
      case "in":
        return Math.round(amount * Unit.INCHES);
    }
  }
  return 0;
};

const normalizeStyle = (s: Style): Style => {
  return cloneDeepWith(s, (values, key) => {
    if (key == "run") {
      return {
        ...values,
        size: values.size
          ? normalizeAsEMU(values.size) / Unit.HALF_PT
          : undefined,
        sizeComplexScript: values.sizeComplexScript
          ? normalizeAsEMU(values.sizeComplexScript) / Unit.HALF_PT
          : undefined
      };
    }

    if (key == "indent") {
      const vals = {
        ...values
      };

      forEach(vals, (value, key) => {
        if (key.endsWith("Chars")) {
          vals[key] = value * 100;
        }
      });

      return vals;
    }

    if (key == "spacing") {
      if (
        (values as IParagraphStylePropertiesOptions["spacing"])!.lineRule ==
        "auto"
      ) {
        return {
          ...values,
          // FIXME find where is the 240 defined.
          // https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.spacingbetweenlines.line?view=openxml-2.8.1
          line: values.line * 240
        };
      }
    }
  });
};

export class Doc {
  static loadConfig = (configRAW: string, defaults: Partial<Config> = {}) => {
    const c = Bun.TOML.parse(configRAW) as Config;
    if (c.style) {
      c.style = mapValues(c.style, (s) => {
        return normalizeStyle(s);
      });
    }
    if (c.numbering) {
      c.numbering = mapValues(c.numbering, (s) => {
        return {
          ...s,
          levels: map(s.levels, (lvl) => {
            return {
              ...lvl,
              style: lvl.style ? normalizeStyle(lvl.style) : undefined
            };
          })
        };
      });

      c.numbering = {
        ...(c.numbering?.["list"]
          ? {
            bullet: ((n) => {
              return {
                ...n,
                levels: map(n.levels, (lvl, i) => {
                  return {
                    ...lvl,
                    format: LevelFormat.BULLET,
                    suffix: LevelSuffix.TAB,
                    text: ["\u25CF", "\u25CB", "\u25A0"][i % 3]
                  };
                })
              };
            })(get(c.numbering, ["list"])!)
          }
          : {}),
        ...c.numbering
      };
    }
    return merge(defaults, c);
  };

  static create(configRAW: string): Doc {
    return new Doc(
      Doc.loadConfig(configRAW, {
        page: {
          size: {
            width: "210mm",
            height: "297mm",
            orientation: PageOrientation.PORTRAIT
          },
          margin: {
            top: "3.5cm",
            bottom: "3.5cm",
            right: "2.8cm",
            left: "2.8cm"
          }
        }
      }) as Config
    );
  }

  constructor(public config: Config) {
  }

  private sections: Section[] = [];

  createSection(configRAW: string): Section {
    const merged = merge({}, this.config, Doc.loadConfig(configRAW));
    const section = new Section(merged);
    this.sections.push(section);
    return section;
  }

  async save() {
    const file = new File({
      styles: this.toStyles(),
      numbering: this.toNumbering(),
      sections: [...this.sections.map((s) => s.toDocxSection())]
    });

    const zip = (Packer as any).compiler.compile(file) as JSZIP;

    const $styles = load(
      String(await zip.file("word/styles.xml")!.async("string")),
      { xmlMode: true }
    );

    const $numbering = load(
      String(await zip.file("word/numbering.xml")!.async("string")),
      { xmlMode: true }
    );

    const patchStyle = ($scope: Cheerio<any>, style?: Style) => {
      if (!style) {
        return;
      }

      const snapToGrid = style.run?.snapToGrid;

      if (!isUndefined(snapToGrid)) {
        const $pPr = $scope.find("w\\:pPr");
        $pPr.remove("w\\:snapToGrid");
        $pPr.append(`<w:snapToGrid w:val="${snapToGrid ? 1 : 0}"/>`);
      }

      const $indent = $scope.find("w\\:pPr > w\\:ind");

      forEach(
        {
          hanging: 0,
          left: 0,
          right: 0,
          firstLine: 0,
          ...style.paragraph?.indent
        },
        (value, attr) => {
          if (!isUndefined(value)) {
            $indent.attr(`w:${attr}`, `${value}`);
          } else {
            $indent.removeAttr(`w:${attr}`);
          }
          if (attr.endsWith("Chars") && !isUndefined(value)) {
            $indent.attr(`w:${attr}`, `${value}`);
            $indent.removeAttr(
              `w:${attr.slice(0, attr.length - "Chars".length)}`
            );
          }
        }
      );
    };

    if (this.config.style) {
      for (const name of Object.keys(this.config.style)) {
        patchStyle(
          $styles(`w\\:style[w\\:styleId="${name}"]`),
          this.config.style[name]!
        );
      }
    }

    if (this.config.numbering) {
      for (const name of Object.keys(this.config.numbering)) {
        const numbering = this.config.numbering[name]!;
        const id = (file as any).numbering.abstractNumberingMap.get(
          `numbering:${name}`
        ).id!;

        forEach(numbering.levels, (lvl, idx) => {
          const $scope = $numbering(
            `w\\:abstractNum[w\\:abstractNumId="${id}"] > w\\:lvl[w\\:ilvl="${idx}"]`
          );

          patchStyle($scope, lvl.style);
        });
      }
    }

    zip.file("word/styles.xml", $styles.xml());
    zip.file("word/numbering.xml", $numbering.xml());

    return await zip.generateAsync({
      type: "nodebuffer",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE"
    });
  }

  getFullStyle = (styleId: string): Style | undefined => {
    const s = get(this.config.style, [styleId]);

    if (s) {
      if (s.basedOn) {
        return merge(this.getFullStyle(s.basedOn), s);
      }
      return s;
    }

    return;
  };

  private toStyles(): IStylesOptions {
    const defaultStyle: IStylesOptions["default"] = mapValues(
      {
        document: get(this.config, ["style", "document"]),
        title: get(this.config, ["style", "title"]),
        heading1: get(this.config, ["style", "heading1"]),
        heading2: get(this.config, ["style", "heading2"]),
        heading3: get(this.config, ["style", "heading3"]),
        heading4: get(this.config, ["style", "heading4"]),
        heading5: get(this.config, ["style", "heading5"]),
        heading6: get(this.config, ["style", "heading6"], {
          basedOn: "normal"
        }),
        listParagraph: get(this.config, ["style", "listParagraph"], {
          basedOn: "normal"
        })
      },
      (s): any => {
        if (s) {
          return s;
        }
      }
    );

    const styles = map(
      omit(this.config.style ?? {}, Object.keys(defaultStyle)),
      (s: Style, id: string) => {
        return {
          ...s,
          id: id
        };
      }
    );

    const [tableStyles, normalStyles] = partition(styles, (s) => {
      return !!s.table;
    });

    const [paragraphStyles, characterStyles] = partition(normalStyles, (s) => {
      return s.paragraph || this.getFullStyle(s.id)?.paragraph;
    });

    for (const { table, id } of tableStyles) {
      if (table && table.cell) {
        paragraphStyles.push({
          ...table.cell,
          name: `${upperFirst(id)} Contents`,
          id: `${id}Contents`
        });

        if (table.style?.firstRow?.cell) {
          paragraphStyles.push({
            ...table.style?.firstRow?.cell,
            name: `${upperFirst(id)} Header Contents`,
            id: `${id}HeaderContents`
          });
        }
      }
    }

    return {
      default: defaultStyle,
      paragraphStyles: paragraphStyles,
      characterStyles: characterStyles
    };
  }

  private toNumbering(): INumberingOptions {
    return {
      config: map(this.config.numbering, (n, reference) => {
        return {
          reference: `numbering:${reference}`,
          levels: map(n.levels, (level, i) => {
            return {
              ...level,
              level: i
            };
          })
        };
      })
    };
  }
}

export class Section {
  constructor(public config: Config) {
  }

  private children: FileChild[] = [];

  add = (node: FileChild) => {
    this.children.push(node);
  };

  contracts = (): Contracts => {
    const size = [
      this.config.page!.size!.width!,
      this.config.page!.size!.height!
    ] as [PositiveUniversalMeasure, PositiveUniversalMeasure];

    const w =
      this.config.page!.size!.orientation == PageOrientation.PORTRAIT
        ? size[0]
        : size[1];
    const h =
      this.config.page!.size!.orientation == PageOrientation.PORTRAIT
        ? size[1]
        : size[0];
    const margin = this.config.page!.margin!;

    return {
      inner: {
        width:
          normalizeAsEMU(w) -
          (normalizeAsEMU(margin.left ?? 0) +
            normalizeAsEMU(margin.right ?? 0)),
        height:
          normalizeAsEMU(h) -
          (normalizeAsEMU(margin.top ?? 0) +
            normalizeAsEMU(margin.bottom ?? 0))
      }
    };
  };

  toDocxSection = (): ISectionOptions => {
    const { style, numbering, ...properties } = this.config;

    return {
      children: Converter.fileChild(...this.children),
      properties: properties as any
    };
  };
}

export type Contracts = {
  inner: {
    width: number;
    height: number;
  };
};
