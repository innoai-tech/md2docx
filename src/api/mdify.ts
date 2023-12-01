import { find, get, map, size, values } from "lodash";
import type { Operation, Schema } from "./schema.ts";


const toTypeDefID = (name: string) => {
  return `typedef:${name}`;
};

const toReqID = (name: string) => {
  return `api:${name}`;
};

const toReqParamsID = (name: string) => {
  return `api:${name}:parameters`;
};

const toRespID = (name: string) => {
  return `api:${name}:response`;
};

export const stringifySchema = (s: Schema): string => {
  if (get(s, "type")) {
    return get(s, "type")! as string;
  }

  if (get(s, "ref")) {
    const name = get(s, "ref")!;
    // wps 不支持上标包裹链接
    return `${name}[:sup[表]](#${toTypeDefID(name)})` as string;
  }

  if (get(s, "values")) {
    return `Map<string, ${stringifySchema(get(s, "values")! as Schema)}>`;
  }

  if (get(s, "elements")) {
    return `${stringifySchema(get(s, "elements")! as Schema)}[]`;
  }

  if (get(s, "oneOf")) {
    const oneOf = get(s, "oneOf", [])!;
    return oneOf.map((v) => stringifySchema(v)).join(" 或 ");
  }

  if (get(s, "enum")) {
    const values = get(s, "enum", [])!;
    return values.map((v) => JSON.stringify(v)).join(" 或 ");
  }

  return "";
};


const keepOneLine = (s: string) => s.replaceAll("\n", "<br>");

export const mdify = (c: {
  operations: Map<string, Operation>,
  definitions: Map<string, Schema>
}) => {

  let md = `
# 接口定义  

`;

  for (const [opID, op] of c.operations) {
    md += `
## ${op.summary}
  
${op.description ?? ""}  

接口详见[表](#${toReqID(opID)})

::caption[${op.summary}接口]{#${toReqID(opID)} type=Table}
  
:::table{orientation=landscape}

| 请求路径    | 请求方法       | 调用方            | 服务方              | 接口描述             | 方式  |
| -------    | ------       | -----            | -----              | -------             | ---- |
| ${op.path} | ${op.method} | ${op.from ?? ""} | ${op.owner ?? ""}  | ${
      op.summary ?? ""
    } | HTTP | 

:::
`;

    if (size(op.parameters) > 0) {
      const requestBody = find(op.parameters, (p) => p.in == "body" && !!p.contentType);

      md +=
        `### 请求参数说明

请求参数说明详见[表](#${toReqParamsID(opID)})

::caption[${op.summary}参数说明]{#${toReqParamsID(opID)} type=Table}

| 参数名称    | 参数类型或值       | 是否必填            | 位置              | 参数含义               | 备注  |
| -------    | ------       | -----           | -----              | -------             | ---- |
${map([
          ...values(op.parameters).filter((p) => !(p.in == "body" && !!p.contentType)),
          ...(requestBody && requestBody.contentType ? [
            {
              name: "Content-Type",
              in: "header",
              schema: {
                enum: [requestBody.contentType]
              } as Schema,
              required: true,
              summary: "",
              description: ""
            },
            requestBody
          ] : [])
        ], (p) => {
          return `| ${[
            p.in == "body" ? "" : p.name,
            stringifySchema(p.schema),
            p.required ? "必填" : "可选",
            p.in,
            p.summary,
            keepOneLine(p.description ?? "")
          ].join(" | ")} |`;
        }).join("\n")}
`;
    }

    md += `### 请求返回说明

请求返回说明详见[表](#${toRespID(opID)})

::caption[${op.summary}返回说明]{#${toRespID(opID)} type=Table}

| HTTP 状态码 | Content-Type | 数据类型或值   | 备注  |
| -------    | ------       | -----     | ----- | 
${map(op.responses, (p, status) => {
      return `| ${[
        status,
        p.contentType,
        p.schema ? stringifySchema(p.schema) : "",
        keepOneLine(p.schema?.metadata?.description ?? "")
      ].join(" | ")} |`;
    }).join("\n")} 
`;
  }

  md += `
# 数据结构定义
  `;

  for (const name of [...c.definitions.keys()].sort()) {
    const s = c.definitions.get(name)!;

    if (get(s, "enum")) {
      const labels = get(s, ["metadata", "enumLabels"], []);

      md += `      
::caption[${name} ${s.metadata?.summary ?? ""}]{#${toTypeDefID(
        name
      )} type=Table}
| 枚举值    |     含义     |
| -------    | ------    |
${map(get(s, "enum", []), (value, i) => {
        return `| ${[value, labels[i]].join(" | ")} |`;
      }).join("\n")}  

${s.metadata?.description ?? ""}
`;

      continue;
    }

    if (get(s, "properties")) {
      md += `
      
::caption[${name} ${s.metadata?.summary ?? ""}]{#${toTypeDefID(
        name
      )} type=Table}

| 字段名称    | 类型       | 是否为空         | 说明               | 备注  |
| -------    | ------     | -----           | -------             | ---- |
${map(get(s, "properties"), (propSchema: Schema, name: string) => {
        return `| ${[
          name,
          stringifySchema(propSchema),
          propSchema.nullable ? "是" : "否",
          propSchema.metadata?.summary ?? "",
          keepOneLine(propSchema.metadata?.description ?? "")
        ].join(" | ")} |`;
      }).join("\n")}    

${s.metadata?.description ?? ""}
`;

      continue;
    }

    md += `
::caption[${name} ${s.metadata?.summary ?? ""}]{#${toTypeDefID(name)} type=Table}   
 
:::table{orientation=landscape}

| 类型        | 说明     |
| -------    | ------   |
| ${stringifySchema(s)} | ${keepOneLine(s.metadata?.description ?? "")} |

:::    
 `;
  }

  return md;
};