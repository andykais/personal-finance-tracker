import * as path from 'node:path'
import { TransactionRecord } from "../ingestors/mod.ts";
import { type Context } from "../context.ts";

export const DATETIME_DAY_FORMAT = 'yyyy/MM/dd'

export abstract class Output {
  protected output_folder: string

  constructor(protected ctx: Context) {
    this.output_folder = path.join(ctx.config.personal_finances_folder, 'output')
  }

  async write(transactions: TransactionRecord[]) {
    const writable = await this.format(transactions)
    await Deno.mkdir(this.output_folder).catch(e => {
      if (e instanceof Deno.errors.AlreadyExists) { /* no error if we have already created the folder */ }
      else throw e
    })
    const output_filepath = this.filepath()
    if (typeof writable === 'string') {
      await Deno.writeTextFile(output_filepath, writable)
    } else {
      await Deno.writeFile(output_filepath, writable)
    }
    this.ctx.log.info(`Wrote ${output_filepath} containing ${transactions.length} transactions`)
  }

  filepath() {
    return path.join(this.output_folder, this.filename())
  }
  abstract filename(): string
  abstract format(transactions: TransactionRecord[]): Promise<string | Uint8Array>
}
