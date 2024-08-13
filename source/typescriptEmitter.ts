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

  public appendCode(text: string) {
    this._code += ` ${text} `;
    return this;
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

    return prettier.format(contents, {
      parser: "typescript",
    });
  }
}
