import { type Operation, type Parameter, type Media, type Schema, stringifySchema } from "../../api";
import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/types";
import { get, has, merge, omit, set } from "lodash";

interface CommentGroup {
  doc: TSESTree.Comment[],
  comments: TSESTree.Comment[]
}

export class Collector {
  static from(p: TSESTree.Program) {
    const c = new Collector();
    const cs = new CommentsScanner(p.comments);

    for (const s of p.body) {
      const cg = cs.getCommentGroupAt(s.loc);

      switch (s.type) {
        case AST_NODE_TYPES.ClassDeclaration:
          c.collectOperation(s, cg);
          break;
        case AST_NODE_TYPES.TSInterfaceDeclaration:
          c.collectInterfaceDefinition(s, cg);
          break;
        case AST_NODE_TYPES.TSTypeAliasDeclaration:
          c.collectTypeDefinition(s, cg);
          break;
        case AST_NODE_TYPES.TSEnumDeclaration:
          c.collectEnumTypeDefinition(s, cg);
          break;
        default:
          console.log("unsupported type", s);
          break;
      }
    }

    for (const [name, s] of c.definitions) {
      const extendedFrom = get(s.metadata, ["extends"]);

      if (extendedFrom && has(s, "properties")) {
        c.extendsSchema(s, name, extendedFrom);
      }
    }

    return c;
  }

  operations = new Map<string, Operation>();
  definitions = new Map<string, Schema>();

  private extendsSchema = (s: Schema, name: string, extendedFrom: string[]): Schema => {
    const final: Schema = {
      properties: {} as Record<string, Schema>,
      metadata: omit(s.metadata, ["extends"]) as any
    };

    for (const e of extendedFrom) {
      let fromSchema = this.definitions.get(e);

      if (fromSchema && has(s, "properties")) {
        const extendedFrom = get(fromSchema, ["extends"]);
        if (extendedFrom) {
          fromSchema = this.extendsSchema(fromSchema, e, extendedFrom);
        }

        final.properties = {
          ...final.properties,
          ...get(fromSchema, "properties", {})
        };
      }
    }

    final.properties = {
      ...final.properties,
      ...get(s, "properties", {})
    };

    this.definitions.set(name, final);

    return final;
  };

  private getDecoratorValues = <T extends { [k: string]: any }>(decorators: TSESTree.Decorator[] = []): T => {
    const m = {} as { [k: string]: any };

    for (const d of decorators) {
      switch (d.expression.type) {
        case AST_NODE_TYPES.CallExpression:
          const key = (d.expression.callee as TSESTree.Identifier).name;
          const arg0 = d.expression.arguments[0];

          if (arg0?.type == AST_NODE_TYPES.Literal) {
            m[key] = JSON.parse(arg0.raw);
          }
      }
    }

    return m as T;
  };

  private collectOperation = (d: TSESTree.ClassDeclaration, cg: CommentGroup) => {
    const operationID = d.id!.name;
    const operation: Operation = {
      method: "",
      path: "",
      parameters: {},
      responses: {},
      ...this.summaryAndDescription(cg.doc)
    };

    const cs = new CommentsScanner(cg.comments);

    const values = this.getDecoratorValues<{
      Owner?: string
      From?: string
      GET?: string
      POST?: string
      PATCH?: string
      PUT?: string
      HEAD?: string
      DELETE?: string
    }>(d.decorators);


    operation.owner = values.Owner;
    operation.from = values.From;

    for (const m of ["GET", "POST", "PATCH", "PUT", "HEAD", "DELETE"]) {
      if (!!get(values, [m])) {
        operation.method = m;
        operation.path = get(values, [m]);
      }
    }

    for (const prop of d.body.body) {
      const subCg = cs.getCommentGroupAt(prop.loc);

      if (prop.type == AST_NODE_TYPES.PropertyDefinition) {
        switch (prop.key.type) {
          case "Literal":
          case "Identifier":
            const name = this.keyOf(prop.key);

            switch (name) {
              case "success$":
              case "onSuccess":
                const responseAttrs = this.getDecoratorValues<{
                  Status?: number
                  ContentType?: string
                }>(prop.decorators);

                const status = responseAttrs.Status ?? 200;

                const media: Media = {
                  contentType: responseAttrs.ContentType ?? "application/json"
                };

                if (status != 204) {
                  media.schema = this.schemaOf(prop.typeAnnotation?.typeAnnotation);
                }

                operation.responses[`${status}`] = media;

                break;
              case "body":
              case "requestBody":
                const requestBodyAttrs = this.getDecoratorValues<{
                  Defaults?: string
                  ContentType?: string
                }>(prop.decorators);

                operation.parameters["requestBody"] = {
                  ...this.summaryAndDescription(subCg.doc),
                  name: name,
                  schema: this.schemaOf(prop.typeAnnotation?.typeAnnotation),
                  required: true,
                  contentType: requestBodyAttrs.ContentType,
                  defaultValue: requestBodyAttrs.Defaults,
                  in: "body"
                };

                break;
              default:
                const paramAttrs = this.getDecoratorValues<{
                  Param?: Parameter["in"]
                  Defaults?: string
                }>(prop.decorators);

                const param: Parameter = {
                  ...this.summaryAndDescription(subCg.doc),
                  name: name,
                  schema: this.schemaOf(prop.typeAnnotation?.typeAnnotation),
                  required: !prop.optional,
                  defaultValue: paramAttrs.Defaults,
                  in: paramAttrs.Param ?? "path"
                };

                operation.parameters[param.name] = param;
            }
            break;
        }
      }
    }

    if (!!operation.method) {
      this.operations.set(operationID, operation);
    }
  };

  private collectInterfaceDefinition(s: TSESTree.TSInterfaceDeclaration, cg: CommentGroup) {
    const o = {
      properties: {} as Record<string, Schema>,
      metadata: {
        ...this.summaryAndDescription(cg.doc)
      }
    };


    for (const e of s.extends) {
      if (e.expression.type === AST_NODE_TYPES.Identifier) {

        set(o.metadata, ["extends"], [
          ...get(o.metadata, ["extends"], []),
          e.expression.name
        ]);
      }
    }

    const cs = new CommentsScanner(cg.comments);

    for (const prop of s.body.body) {
      this.collectProperty(cs, prop, (propName, propSchema) => {
        o.properties[propName] = propSchema;
      });
    }

    this.definitions.set(s.id.name, o);
  }

  private collectTypeDefinition(s: TSESTree.TSTypeAliasDeclaration, cg: CommentGroup) {
    switch (s.typeAnnotation.type) {
      case AST_NODE_TYPES.TSTypeLiteral:
        const o = {
          properties: {} as Record<string, Schema>,
          metadata: {
            ...this.summaryAndDescription(cg.doc)
          }
        };

        const cs = new CommentsScanner(cg.comments);

        for (const prop of s.typeAnnotation.members) {
          this.collectProperty(cs, prop, (propName, propSchema) => {
            o.properties[propName] = propSchema;
          });
        }

        this.definitions.set(s.id.name, o);
        return;
      default:
        this.definitions.set(s.id.name, merge(this.schemaOf(s.typeAnnotation), {
          metadata: {
            ...this.summaryAndDescription(cg.doc)
          }
        }));
        return;
    }
  }

  private collectProperty = (cs: CommentsScanner, prop: TSESTree.TypeElement, callback: (prop: string, schema: Schema) => void) => {
    const subCg = cs.getCommentGroupAt(prop.loc);

    if (prop.type == "TSPropertySignature") {
      switch (prop.key.type) {
        case "Literal":
        case "Identifier":
          callback(this.keyOf(prop.key), merge(this.schemaOf(prop.typeAnnotation?.typeAnnotation), {
            nullable: prop.optional,
            metadata: {
              ...this.summaryAndDescription(subCg.doc)
            }
          }));
      }
    }
  };

  private keyOf = (node: TSESTree.Identifier | TSESTree.Literal): string => {
    if (node.type == AST_NODE_TYPES.Literal) {
      return JSON.parse(node.raw);
    }
    return node.name;
  };

  private collectEnumTypeDefinition(d: TSESTree.TSEnumDeclaration, cg: CommentGroup) {
    const s = {
      enum: [] as any[],
      metadata: {
        ...this.summaryAndDescription(cg.doc),
        enumLabels: [] as string[]
      }
    };

    const cs = new CommentsScanner(cg.comments);

    for (const m of d.members) {
      const subCg = cs.getCommentGroupAt(m.loc);

      if (m.id.type == AST_NODE_TYPES.Identifier) {
        const value = m.id.name;
        s.enum.push(value);

        const meta = this.summaryAndDescription(subCg.doc);
        s.metadata.enumLabels.push(meta.summary ?? value);
      }
    }

    this.definitions.set(d.id.name, s);
  }


  summaryAndDescription = (comments: TSESTree.Comment[]) => {
    if (comments.length == 0) {
      return {
        summary: ""
      };
    }

    return {
      summary: comments[0]?.value.trim() ?? "",
      description: comments
        .filter((_, i) => i > 0)
        .map((v) => v.value.trim())
        .join("\n")
    };
  };


  private schemaOf(t?: TSESTree.TypeNode): Schema {
    switch (t?.type) {
      case AST_NODE_TYPES.TSTemplateLiteralType:
        let tt = `"`;

        for (let i = 0; i < t.quasis.length; i++) {
          tt += t.quasis[i]!.value.cooked;

          const param = t.types[i];

          if (param) {
            tt += `{${stringifySchema(this.schemaOf(param))}}`;
          }
        }

        tt += `"`;

        return {
          type: tt
        };
      case AST_NODE_TYPES.TSLiteralType:
        if (t.literal.type == AST_NODE_TYPES.Literal) {
          return {
            enum: [JSON.parse(t.literal.raw)]
          } as Schema;
        }
        break;
      case AST_NODE_TYPES.TSTypeReference:
        const name = (t.typeName as TSESTree.Identifier).name;

        switch (name) {
          case "Map":
          case "Record":
            if (!!t.typeArguments) {
              return {
                values: this.schemaOf(t.typeArguments.params[1])
              };
            }
            break;
          case "Array":
            if (!!t.typeArguments) {
              return {
                elements: this.schemaOf(t.typeArguments.params[0])
              };
            }
            break;
        }

        return {
          ref: name
        };
      case AST_NODE_TYPES.TSStringKeyword:
        return {
          type: "string"
        };
      case AST_NODE_TYPES.TSNumberKeyword:
        return {
          type: "number"
        };
      case AST_NODE_TYPES.TSBooleanKeyword:
        return {
          type: "boolean"
        };
      case AST_NODE_TYPES.TSUnionType:
        const oneOf = [];

        for (const s of t.types) {
          switch (s.type) {
            case AST_NODE_TYPES.TSTypeReference:
              oneOf.push(this.schemaOf(s));
              break;
            default:
              throw new Error(`TSUnionType only support TSTypeReference, but got ${s.type}`);
          }
        }

        return {
          oneOf: oneOf
        };
      case AST_NODE_TYPES.TSAnyKeyword:
        return {};
      case AST_NODE_TYPES.TSArrayType: {
        return {
          elements: this.schemaOf(t.elementType)
        };
      }
    }

    throw new Error(`unsupported type: ${JSON.stringify(t)}`);
  }
}


class CommentsScanner {
  current: TSESTree.Position = { line: 0, column: 0 };

  constructor(private comments: TSESTree.Comment[] = []) {

  }

  getCommentGroupAt(loc: TSESTree.SourceLocation): CommentGroup {
    const doc = this.getComments(this.current, loc.start);

    this.current = loc.end;

    return {
      doc,
      comments: this.getComments(loc.start, loc.end)
    };
  }

  private getComments(start: TSESTree.Position, end: TSESTree.Position) {
    return this.comments.filter((c) => start.line < c.loc.start.line && c.loc.end.line <= end.line);
  };
}
