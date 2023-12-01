export type Operation = {
  method: string;
  path: string;
  owner?: string;
  from?: string;
  summary: string;
  description?: string;
  parameters: Record<string, Parameter>;
  responses: Record<number, Media>;
};

export type Media = {
  contentType: string;
  schema?: Schema;
};

export type Parameter = {
  name: string;
  summary: string;
  description?: string;
  in: "query" | "path" | "body" | "header";
  required?: boolean;
  contentType?: string;
  schema: Schema;
  defaultValue: any;
};

// https://jsontypedef.com/docs/jtd-in-5-minutes/
export type Schema = {
  nullable?: boolean;
  metadata?: {
    summary: string;
    description?: string;
    [k: string]: any;
  };
} & (
  | {
  type: string;
}
  | {
  enum: any[];
  metadata: {
    enumLabels: string[];
  };
}
  | {
  ref: string;
}
  | {
  // Array
  elements: Schema;
}
  | {
  // Object
  properties?: Schema;
}
  | {
  // Map
  values: Schema;
} | {
  // oneOf
  oneOf: Schema[]
}
  | {
  // unit tag
  discriminator: string;
  mapping: Record<
    string,
    {
      properties: Schema;
    }
  >;
});
