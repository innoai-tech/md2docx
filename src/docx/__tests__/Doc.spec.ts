import { describe, it } from "bun:test";
import { Doc } from "../Doc.ts";

describe("Section", () => {
  it("should return ", () => {
    const doc = Doc.create("");
    const s = doc.createSection("");

    console.log(s.contracts());
  });
});
