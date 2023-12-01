#!/usr/bin/env bun

import { Command } from "commander";
import { join } from "path";
import { convert } from "../src";

const cmd = new Command();

cmd
  .command("convert <entry.md>")
  .option("--output [.docx]", "output file")
  .description("convert markdown project to docx")
  .action(async (entry, opts) => {
    await convert({
      entry: join(process.cwd(), entry),
      output: opts.output,
    });
    return;
  });

cmd.parse(process.argv);
