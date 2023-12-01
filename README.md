# Markdown to Docx

## 如何使用

- 安装 [Bun](https://bun.sh/)

```shell
bunx @innoai-tech/md2docx convert --output=./path/to/output.docx ./path/to/src.md
```

## Markdown 特性

- [GitHub Flavored Markdown](https://github.github.com/gfm/)

### 扩展

#### 文件引入与加载器

```md
# 一级标题

::embed{url=./path/to/sub.md}
```

##### 已支持的加载器

- `/\.md$/` 合并子 markdown 文件
- `/\.api.gql$/` 将 GraphQL 声明的 API 文档转换为标准 API 表格
- `/\.mmd$/` 将 mermaid 定义生成为图片链接

#### 图、表、公式标题与自动编号

```md
::caption[图表公式标题]{#caption-id type=Figure|Table|Equation}
```

#### 交叉引用

```md
[表](#caption-id)

[图](#caption-id)

[公式](#caption-id)
```

#### 表格配置

1. 表格方向

   ```md
   :::table{orientation=portrait|landscape}

   :::
   ```

2. 单元格设置

   ```md
   :attr{colspan=2}
   :attr{rowspan=2}
   ```
