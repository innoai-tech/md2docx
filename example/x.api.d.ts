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
  kind: "Deployment";
  spec: ManifestSpec;
}

type ManifestSpec = {
  version: string
}

interface Config extends ManifestHeader {
  kind: "Config";
  spec: ConfigSpec;
}

type ConfigSpec = {
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