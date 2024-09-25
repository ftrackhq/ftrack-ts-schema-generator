import prettier from "prettier";

export class TypeScriptEmitter {
  private _code: string;
  private _errors: Array<string>;

  public get errors(): ReadonlyArray<string> {
    return this._errors;
  }

  public constructor() {
    this._code = "";
    this._errors = [];
  }

  public appendInline(text: string) {
    this._code += text;
    return this;
  }

  public appendBlock(text: string) {
    return this.appendInline(` ${text} `);
  }

  public appendError(message: string) {
    this._errors.push(message);
  }

  public toString() {
    let contents = this._code;

    if (this._errors.length > 0) {
      contents += "//Errors:\n";
      contents += this._errors.map((x) => `//${x}`).join("\n");
    }

    try {
      return prettier.format(contents, {
        parser: "typescript",
      });
    } catch (e) {
      console.error("Format failed", e, this._code);
      throw e;
    }
  }
}
