import { Cursor, process } from "./markdown";
import { basename, dirname } from "path";
import { toDocx } from "./md2docx";
import {
  attrDirectiveAsParentData,
  captionDirectiveAsParagraph,
  defaultLoaders,
  embedDirective,
  imageLoadWithMeta,
  tableDirectiveAsChildData
} from "./markdown/visitors";
import { mermaid2imgLoader } from "./loaders/mermaid2img";
import { gql2apiLoader } from "./loaders/gql2api";
import { writeFile, mkdir } from "fs/promises";
import { OsFS } from "./fs";
import { dts2apiLoader } from "./loaders/dts2api";

export const convert = async ({
                                entry,
                                output
                              }: {
  entry: string;
  output: string;
}): Promise<void> => {
  const fs = new OsFS();

  const entryFile = await fs.load(basename(entry), {
    cwd: dirname(entry)
  });

  const configFile = await fs.load(".docx.toml", {
    cwd: dirname(entry)
  });

  const node = await process(entryFile, {
    visitors: [
      attrDirectiveAsParentData(),
      captionDirectiveAsParagraph(),
      tableDirectiveAsChildData(),
      imageLoadWithMeta(),
      embedDirective({
        loaders: [...defaultLoaders, mermaid2imgLoader({}), gql2apiLoader(), dts2apiLoader()]
      })
    ]
  });

  const doc = await toDocx(Cursor.of(node, { file: entryFile }), {
    configRAW: String(configFile.value)
  });

  await mkdir(dirname(output), { recursive: true });
  return await writeFile(output, await doc.save());
};
