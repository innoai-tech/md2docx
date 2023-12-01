declare global {
  function GET(path: string): <T extends { new(...args: any[]): {} }>(constructor: T) => void

  function POST(path: string): <T extends { new(...args: any[]): {} }>(constructor: T) => void

  function DELETE(path: string): <T extends { new(...args: any[]): {} }>(constructor: T) => void

  function PUT(path: string): <T extends { new(...args: any[]): {} }>(constructor: T) => void

  function HEAD(path: string): <T extends { new(...args: any[]): {} }>(constructor: T) => void

  function Param(locate: "path" | "query" | "header" | "cookie"): (prop: any) => void

  function Owner(owner: string): (prop: any) => void

  function From(client: string): (prop: any) => void

  function ContentType(t: string): (prop: any) => void

  function Status(code: number): (prop: any) => void

  function Defaults(value: any): (prop: any) => void
}