import type { TableNode } from "./ast";

export const rotateTable = (table: TableNode): TableNode => {
  const t: TableNode = {
    type: "Table",
    options: {},
    children: [],
  };

  const rows = table.children;

  if (rows.length >= 2) {
    const row0 = rows[0]!;

    for (let i = 0; i < row0.children.length; i++) {
      t.children.push({
        type: "TableRow",
        options: {},
        children: rows.map((row) => {
          return row.children[i]!;
        }),
      });
    }
  }

  return t;
};
