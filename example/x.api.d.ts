// 查询列表
//
// 描述
@Owner("Centre Service")
@GET("/v1/types")
class ListMeta {
  // provider
  @Param("query")
  provider?: string;

  // type
  @Param("query")
  type?: string;

  @ContentType("application/json")
  requestBody: Deployment

  @Status(200)
  success$: MetaList;
}

// 元数据列表
type MetaList = {
  // 元数据列表
  items: Array<Meta>
}

// 清单
interface ManifestHeader {
  // 种类
  kind: string;
  // 版本
  apiVersion: string;
}


interface Deployment extends ManifestHeader {
  // kind
  kind: "Deployment";
  // spec
  spec: ManifestSpec;
  // status
  status?: ConfigSpec;
}

type ManifestSpec = {
  // version
  version: string
  // image
  image: string
  // meta
  metaA: Meta
  // meta
  metaB: Meta
  // 结果
  result: ResultValidation
}

interface Config extends ManifestHeader {
  // kind
  kind: "Config";
  // spec
  spec: ConfigSpec;
}

type ConfigSpec = {
  // data
  data: Map<string, string>
}

type Manifest = Deployment | Config

// 元数据
type  Meta = {
  // 供应商
  provider: Provider
  // 类型
  "type"?: Type
  // 注解
  annotations: Record<string, string>
};

// 部署阶段
enum DeploymentStage {
  // 待部署
  NOT_READY,
  // 部署中
  PROCESSING,
  //  部署完成
  READY,
  // 部署失败
  FAILED,
}

// 供应商
type Provider = string

// 种类
type Kind = string

// 类型
type Type = `${Provider}.${Kind}.v${number}`


// 结果表达式
//
// 与 [JSON Schema](https://json-schema.org/) 一致
// 当前暂时支持 enum 和 number range
type ResultValidation = EnumValidation | NumberValidation

// Enum 验证
type EnumValidation = {
  // 枚举值
  // 当只有一个时，等效 等于
  enum: any[]
}

// Number 验证
// https://json-schema.org/understanding-json-schema/reference/numeric#range
type NumberValidation = {
  // 大等于
  // 和 exclusiveMinimum 二选一
  minimum?: number
  // 大于
  // 和 minimum 二选一
  exclusiveMinimum?: number
  // 小等于
  // 和 exclusiveMaximum 二选一
  maximum?: number
  // 小于
  // 和 maximum 二选一
  exclusiveMaximum?: number
}
