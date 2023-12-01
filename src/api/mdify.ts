import { filter, find, forEach, get, last, map, reduce, size, values } from "lodash";
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

const toRespID = (name: string,status: string) => {
  return `api:${name}:response:${status}`;
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

  return "any";
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
    const requestBody = find(op.parameters, (p) => p.in == "body" && !!p.contentType);
    const parameters = filter(op.parameters, (p) => !(p.in == "body" && !!p.contentType));

    md += `
## ${op.summary}
  
${op.description ?? ""}  

接口详见[表](#${toReqID(opID)})

::caption[${op.summary}接口]{#${toReqID(opID)} type=Table}
  
:::table{orientation=landscape}

| 请求路径    | 请求方法       | 调用方            | 服务方              | 接口描述             | 方式  | 请求头 |
| -------    | ------       | -----            | -----              | -------             | ---- | ----  |
| ${op.path} | ${op.method} | ${op.from ?? ""} | ${op.owner ?? ""}  | ${op.summary ?? ""} | HTTP | ${requestBody?.contentType ? `Content-Type: ${requestBody?.contentType}`: "" } |
:::
`;

    if (size(parameters) > 0 || requestBody) {
      const [items, maxDepth]= exposeSchema({
        properties: {
          ...reduce(parameters, (props, p) => {
            return Object.assign(props, {
              [p.name]: {
                ...p.schema,
                metadata: {
                  ...p.schema.metadata,
                  summary: p.summary ?? p.schema.metadata?.summary,
                  description: `[${p.in} 参数]<br> ${p.description ?? p.schema.metadata?.description ?? ""}`,
                },
                nullable: !p.required
              }
            })
          },{} as any),

          ...(requestBody ? {
            "$$body": {
              ...requestBody.schema,
              metadata: {
                ...requestBody.schema.metadata,
                summary: "请求体参数",
                description: `${requestBody.description ?? requestBody.schema.metadata?.description ?? ""}`,
              },
              nullable: false
            }
          }:{})
        }
      }, c.definitions)

      if (items.length) {

        md +=
          `          
### 请求参数说明

请求参数说明详见[表](#${toReqParamsID(opID)})
::caption[${op.summary}参数说明]{#${toReqParamsID(opID)} type=Table}
`;
      }

      md += itemsToMD([
        "参数名称",
        "类型",
        "必选/可选",
        "参数含义",
        "备注"
      ], items, maxDepth)
    }

    md += `### 接收响应
`
  forEach(op.responses, (mt, status) => {
    md += `
    

:::table{orientation=landscape}
| 请求状态码 | Content-Type | 
| ---- | ---- |
| ${status} | ${status != 204 ? `${mt.contentType}`: "" } |
:::
`

    if (mt.schema) {
      const [items, maxDepth] = exposeSchema(mt.schema, c.definitions)

      md += `
接收响应返回值见[表](#${toRespID(opID, status)})

::caption[${op.summary}返回说明]{#${toRespID(opID, status)} type=Table}
`

      md += itemsToMD([
        `字段名称`,
        `类型`,
        "说明",
        "备注"
      ],items, maxDepth, false)
    }
  })

  }

md += `
`

  return md;
};


function itemsToMD(headers: string[], items: Item[], maxDepth: number, showRequired= true) {
  let md = [
    "",
    ...headers.map((v, i) => {
      if (i === 0) {
        return `${v} :attr{colspan=${maxDepth}}`
      }
      return v
    }),
    "\n"
  ].join(" | ")

  md += ["",
    ...headers.map(() => "---"),
    "\n"
  ].join(" | ")

  const getScope = (path: string[]) => {
    return path.slice(0, path.length-1).join(".")
  }

  const calRowspan = (startIdx: number) => {
    let rowspan = 1;

    const prefix = getScope(items[startIdx].path)

    for (let i = startIdx+1; i<items.length; i++) {
      const item = items[i];

      if (!item.summary) {
        continue
      }

      const p = items[i].path.join(".")

      if (!p.startsWith(prefix)) {
        break;
      }

      rowspan++
    }

    return rowspan;
  }

  const rowspanSet: any = {}
  let currentPath = []

  const isScopeChanged = (path: string[] = []) => {
    return getScope(currentPath) != getScope(path)
  }

  for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
    const item = items[rowIdx]!

    if (!item.summary) {
      continue
    }


    if (item.summary == "请求体参数") {
      md+= ` | ${item.summary} :attr{colspan=${(headers.length -1) + maxDepth}} |
`
      continue
    }

    if(item.type == "|") {
        md+= ` | ${item.summary} :attr{colspan=${(headers.length -1) + maxDepth}} |
`
      continue
    }

    md += [
      "",
      ...item.path.length ? item.path.map((name, index, all) =>  {
        const isLast =  all.length -1 == index
        if (isLast) {
          return `${name} :attr{colspan=${maxDepth-all.length + 1}}`
        }
        if (isScopeChanged(item.path) && index == 0) {
          const scope = getScope(item.path);

          if (!rowspanSet[scope]) {
            rowspanSet[scope]= true
            const rowspan = calRowspan(rowIdx);
            return `:attr{rowspan=${rowspan}}`
          }
        }
        return undefined
      }).filter((v) => v) : [
        ""
      ],
      item.type,
      ...showRequired ? [(item.required ? "必选": "可选")]:[],
       keepOneLine(item.summary ?? ""),
      (showRequired ? "": (`${item.required ? "" :"[可能为空] <br>"}`)) +keepOneLine(item.description ?? ""),
      "\n"
    ].join( " | ")


    currentPath = item.path;
  }

  console.log(md)

  return md
}


type Item = {
  path: string[]
  type: string
  required?: boolean
  summary?: string
  description?: string
}

function exposeSchema(s: Schema, $def: Map<string, Schema>)  {
  let maxDepth = 0;

  const isObjectSchema = (schema: Schema) => {
    if (get(schema, "ref")) {
      const found = $def.get(get(schema, "ref", ""))!

      if (!found) {
        throw new Error(`not found ${get(s, "ref")}`)
      }

      return get(found, "properties")
    }
    return get(schema, "properties")
  }

  const walkSchema = (s: Schema, path: string[]) => {
    if (get(s, "ref")) {
      const metadata = s.metadata
      const found = $def.get(get(s, "ref", ""))!

      if (!found) {
        throw new Error(`not found ${get(s, "ref")}`)
      }

      s = {
        ...found,
        metadata: {
          summary: metadata?.summary ?? "",
          description:  metadata?.description ?? found.metadata?.description ??"",
        }
      }
    }

    if (get(s, "elements") && isObjectSchema(get(s, "elements")!)) {
      return [
        {
          path: path,
          type: "[]",
          required: !s.nullable,
          summary: s.metadata?.summary,
          description: s.metadata?.description,
        },
        ...walkSchema(get(s, "elements")!, path)
      ]
    }

    if (get(s, "values") && isObjectSchema(get(s, "values")!)) {
      return [
        {
          path: path,
          type: "Map<string, {}>",
          required: !s.nullable,
          summary: s.metadata?.summary,
          description: s.metadata?.description,
        },
        ...walkSchema(get(s, "values")!, path)
      ]
    }

    if (get(s, "elements")) {
      let elemSchema = get(s, "elements")

      if (get(elemSchema, "ref")) {
        elemSchema = $def.get(get(elemSchema, "ref", ""))!
      }

      s = { elements: elemSchema, metadata: s.metadata }
    }

    if (get(s, "properties")) {
      const props = get(s, "properties") as {}

      let items: Array<Item> = [
        {
          path: path,
          type: "{}",
          required: !s.nullable,
          summary: s.metadata?.summary,
          description: s.metadata?.description,
        }
      ]

      for (const k in props) {
        items = [
          ...items,
          ...walkSchema(props[k]!, [...path, k]),
        ]
      }

      return items
    }

    if (get(s, "oneOf")) {
      const oneOf = get(s, "oneOf", [])!;

      let items: Item[] = [
        {
          path: path,
          type: "",
          required: !s.nullable,
          summary: s.metadata?.summary,
          description: s.metadata?.description,
        }
      ]

      for (let i = 0; i < oneOf.length; i++){
        const p = [...path, `$$${i}`]
        const s = oneOf[i];

        items = [
          ...items,
          {
            path: p,
            type: "|",
            required: !s.nullable,
            summary: "或",
          },
          ...walkSchema(s, p),
        ]
      }

      return items;
    }

    if (path.length > maxDepth) {
      maxDepth = path.length
    }

    return [
      {
        path: path,
        type: stringifySchema(s),
        required: !s.nullable,
        summary: s.metadata?.summary,
        description: s.metadata?.description,
      }
    ];
  }

  return [walkSchema(s,[]), maxDepth]
}