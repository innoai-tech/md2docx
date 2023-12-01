import type { FS } from "./interface.ts";
import { type Value, VFile } from "vfile";
import { join } from "path";
import { relative } from "path";

export class MemFS implements FS {
  constructor(
    protected files: Record<string, string>,
    protected prefix = process.cwd(),
  ) {}

  async load(path: string, opt?: { cwd?: string }): Promise<VFile> {
    const cwd = opt?.cwd ?? ".";
    const p = relative(this.prefix, join(cwd, path));

    return new VFile({
      path: path,
      value: this.files[p],
      cwd: cwd,
    });
  }

  async save(path: string, data: Value, opt?: { cwd?: string }): Promise<void> {
    const cwd = opt?.cwd ?? ".";
    const p = relative(this.prefix, join(cwd, path));
    this.files[p] = String(data);
  }
}
