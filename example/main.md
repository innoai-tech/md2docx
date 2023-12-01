+++
page.size.orientation = "portrait"
+++

# 主标题

## 一级标题

内容详见[表](#table-x)

我是表格:caption{#table-x type=Table}

:::table{orientation=landscape}

| 字段名 | 类型     | 描述 |
|-----|--------|----|
| a   | string | x  |

:::

我是表格:caption{#table-x-1 type=Table}

| 字段名 | 类型     | 描述 |
|-----|--------|----|
| a   | string | x  |

![](https://picsum.photos/seed/picsum/1600/900)

我是图片:caption{#figure-x type=Figure}

如[图](#figure-x)所示

```json
{
  "a": 1
}
```

- list 1
    - list 2

1. ordered 1
2. ordered 2
    1. sub 1
        1. sub 1

# 附录 A： API

::embed{url=x.api.d.ts}
