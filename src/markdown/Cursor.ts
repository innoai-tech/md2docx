import type { Node } from "mdast";
import type { VFile } from "vfile";

export interface Parent<N extends Node = Node> extends Node {
  children: N[];
}

export class Cursor<T extends Node = Node> {
  static of<T extends Node>(
    node: T,
    options: { file: VFile; parent?: Cursor },
  ) {
    return new Cursor(node, options.file, options.parent);
  }

  constructor(
    public node: T,
    public file: VFile,
    public parent?: Cursor,
  ) {}

  *children(): Iterable<Cursor<T extends Parent<infer N> ? N : Node>> {
    if (this.isParent()) {
      for (const node of this.node.children) {
        yield Cursor.of(node, {
          file: this.file,
          parent: this,
        }) as any;
      }
    }
  }

  patchData(data: Record<string, any>) {
    Object.assign((this.node.data ??= {}), data);
  }

  remove() {
    if (!this.parent) {
      return;
    }

    const parentNode = this.parent.node as Parent;
    parentNode.children = parentNode.children.filter((n) => n != this.node);
  }

  replaceWith(...newNodes: Node[]) {
    if (!this.parent) {
      this.node = {
        type: "root",
        children: newNodes,
      } as Node as T;
      return;
    }

    const parentNode = this.parent.node as Parent;

    const oldNodeIdx = parentNode.children.indexOf(this.node);

    if (oldNodeIdx > -1) {
      const left = parentNode.children.slice(0, oldNodeIdx);
      const right = parentNode.children.slice(oldNodeIdx + 1);

      parentNode.children = [...left, ...newNodes, ...right];

      return;
    }

    parentNode.children = [...parentNode.children, ...newNodes];
  }

  isToml(): this is Cursor<{ type: "toml"; value: string }> {
    return this.node.type == "toml";
  }

  isParent(): this is Cursor<Parent> {
    return !!(this.node as any).children;
  }
}

declare module "mdast" {
  export interface ImageData {
    type: "Buffer";
    contents: Buffer;
    meta?: {
      width: number;
      height: number;
    };
  }
}
