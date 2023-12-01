import type {
  DirectiveNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  StringValueNode,
  TypeNode,
  ValueNode
} from "graphql/language/ast";
import { merge, split } from "lodash";
import { Kind } from "graphql/language";
import { type Schema, type Parameter, type Operation } from "../../api";

export class Collector {
  static from(n: DocumentNode) {
    const c = new Collector();

    for (const d of n.definitions) {
      switch (d.kind) {
        case "ObjectTypeDefinition":
          if (d.name.value == "Query" || d.name.value == "Mutation") {
            c.collectOperations(d);
            continue;
          }
          c.collectObjectTypeDefinition(d);
          break;
        case "InputObjectTypeDefinition":
          c.collectObjectTypeDefinition(d);
          break;
        case "EnumTypeDefinition":
          c.collectEnumTypeDefinition(d);
          break;
      }
    }

    return c;
  }

  operations = new Map<string, Operation>();
  definitions = new Map<string, Schema>();

  collectOperations = (d: ObjectTypeDefinitionNode) => {
    if (d.fields) {
      for (const f of d.fields) {
        const operationID = f.name.value;

        const operation: Operation = {
          method: "",
          path: "",
          parameters: {},
          responses: {},
          ...this.summaryAndDescription(f.description)
        };

        if (f.arguments) {
          for (const arg of f.arguments) {
            const { nullable, ...schema } = this.schemaOf(arg.type);

            const param: Parameter = {
              ...this.summaryAndDescription(arg.description),
              name: arg.name.value,
              schema: schema,
              required: !nullable,
              defaultValue: this.valueOf(arg.defaultValue),
              in: "path"
            };

            if (arg.directives) {
              for (const directive of arg.directives) {
                switch (directive.name.value) {
                  case "param":
                    this.directiveArgumentsAssignTo(param, directive);
                    break;
                }
              }
            }

            operation.parameters[param.name] = param;
          }

          const response = {
            status: 200,
            contentType: "application/json"
          };

          if (f.directives) {
            for (const directive of f.directives) {
              switch (directive.name.value) {
                case "operation":
                  this.directiveArgumentsAssignTo(operation, directive);
                  break;
                case "returns":
                  if (directive.arguments) {
                    for (const arg of directive.arguments) {
                      switch (arg.name.value) {
                        case "status":
                          this.directiveArgumentsAssignTo(response, directive);
                          break;
                      }
                    }
                  }

                  break;
              }
            }
          }

          operation.responses[`${response.status}`] = {
            contentType: response.contentType,
            schema: this.schemaOf(f.type)
          };
        }

        this.operations.set(operationID, operation);
      }
    }
  };

  collectEnumTypeDefinition = (d: EnumTypeDefinitionNode) => {
    if (d.values) {
      const s = {
        enum: [] as any[],
        metadata: {
          ...this.summaryAndDescription(d.description),
          enumLabels: [] as string[]
        }
      };

      for (const v of d.values) {
        s.enum.push(v.name.value);
        const meta = this.summaryAndDescription(v.description);
        s.metadata.enumLabels.push(meta.summary ?? v.name.value);
      }

      this.definitions.set(d.name.value, s);
    }
  };

  collectObjectTypeDefinition = (
    d: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode
  ) => {
    const o = {
      properties: {} as Record<string, Schema>,
      metadata: {
        ...this.summaryAndDescription(d.description)
      }
    };

    if (d.fields) {
      for (const f of d.fields) {
        o.properties[f.name.value] = merge(this.schemaOf(f.type), {
          metadata: {
            ...this.summaryAndDescription(f.description)
          }
        });
      }
    }

    this.definitions.set(d.name.value, o);
  };

  summaryAndDescription = (n?: StringValueNode) => {
    if (!n) {
      return {
        summary: ""
      };
    }

    const parts = split(n.value, "\n", 2);

    return {
      summary: parts[0] ?? "",
      description: parts[1]
    };
  };

  directiveArgumentsAssignTo = (target: any, directive: DirectiveNode) => {
    if (directive.arguments) {
      for (const arg of directive.arguments) {
        Object.assign(target, {
          [arg.name.value]: this.valueOf(arg.value)
        });
      }
    }
  };

  schemaOf = (n: TypeNode): Schema => {
    switch (n.kind) {
      case Kind.NAMED_TYPE:
        switch (n.name.value) {
          case "String":
            return {
              type: "string"
            };
          case "Float":
            return {
              type: "float"
            };
          case "Int":
            return {
              type: "int"
            };
          case "Boolean":
            return {
              type: "boolean"
            };
          case "Timestamp":
            return {
              type: "timestamp"
            };
          case "Void":
            return {
              nullable: true
            };
        }
        return {
          ref: n.name.value
        };
      case Kind.LIST_TYPE:
        return {
          elements: this.schemaOf(n.type)
        };
      case Kind.NON_NULL_TYPE:
        return {
          ...this.schemaOf(n.type),
          nullable: false
        };
    }
  };

  valueOf = (v?: ValueNode): any => {
    if (v) {
      switch (v.kind) {
        case Kind.STRING:
          return v.value;
        case Kind.BOOLEAN:
          return v.value;
        case Kind.INT:
          return parseInt(v.value);
        case Kind.FLOAT:
          return parseFloat(v.value);
        case Kind.NULL:
          return null;
        case Kind.OBJECT:
          const o: any = {};
          for (const f of v.fields) {
            o[f.name.value] = this.valueOf(f.value);
          }
          return o;
        case Kind.LIST:
          const items: any[] = [];
          for (const item of v.values) {
            items.push(this.valueOf(item));
          }
          return items;
      }
    }
    return undefined;
  };
}
