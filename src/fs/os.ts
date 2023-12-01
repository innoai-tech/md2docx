import type { FS } from "./interface.ts";
import { type Value, VFile } from "vfile";
import { readFile, mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

export class OsFS implements FS {
  async load(path: string, opt?: { cwd: string }): Promise<VFile> {
    const cwd = opt?.cwd ?? ".";

    return new VFile({
      path: path,
      value: await readFile(join(cwd, path)),
      cwd: cwd
    });
  }

  async save(path: string, data: Value, opt?: { cwd?: string }): Promise<void> {
    const cwd = opt?.cwd ?? ".";
    const p = join(cwd, path);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
}
