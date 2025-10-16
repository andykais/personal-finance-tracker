export interface ParserConfig {
  input_path: string
}

export class Parser {
  constructor(protected config: ParserConfig) {}
}
