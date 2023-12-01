import { type Value, VFile } from "vfile";

export interface FS {
  load(path: string, opt?: { cwd?: string }): Promise<VFile>;

  save(path: string, data: Value, opt?: { cwd?: string }): Promise<void>;
}
