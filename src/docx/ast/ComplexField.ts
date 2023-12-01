import { XmlAttributeComponent, XmlComponent } from "docx";

export class FldCharBegin extends XmlComponent {
  constructor() {
    super("w:fldChar");
    this.root.push(new FldCharAttrs({ type: "begin" }));
  }
}

export class InstrText extends XmlComponent {
  constructor(instruction: string) {
    super("w:instrText");
    this.root.push(instruction);
  }
}

export class FldCharSeparate extends XmlComponent {
  constructor() {
    super("w:fldChar");
    this.root.push(new FldCharAttrs({ type: "separate" }));
  }
}

export class FldCharEnd extends XmlComponent {
  constructor() {
    super("w:fldChar");
    this.root.push(new FldCharAttrs({ type: "end" }));
  }
}

class FldCharAttrs extends XmlAttributeComponent<{ type: string }> {
  constructor(attrs: { type: string }) {
    super(attrs);

    Object.assign(this, {
      xmlKeys: {
        type: "w:fldCharType",
      },
    });
  }
}
