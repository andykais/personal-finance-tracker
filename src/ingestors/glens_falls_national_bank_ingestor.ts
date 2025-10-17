import path from 'node:path'
import * as fs from '@std/fs'
import { PDFParser } from "../parsers/pdf_parser.ts";
import { GlensFallsNationalBankParser } from "../parsers/glens_falls_national_bank_statement_parser.ts";
import { Ingestor, type TransactionRecord } from "./mod.ts";
import { type Context } from "../context.ts";

export class GlensFallsNationalBankIngestor extends Ingestor {
  name = 'Glens Falls National Bank'
  pdf_parser: PDFParser
  glens_falls_national_bank_parser: GlensFallsNationalBankParser

  constructor(ctx: Context) {
    super(ctx)
    this.pdf_parser = new PDFParser(ctx, { strip_out_fonts: ['g_d2_f3', 'g_d0_f3'] })
    this.glens_falls_national_bank_parser = new GlensFallsNationalBankParser(ctx)
  }

  override async load(): Promise<TransactionRecord[]> {
    const statements_folder = path.join(this.ctx.config.personal_finances_folder, 'statements', 'glens_falls_national_bank')
    const files = fs.walk(statements_folder, {exts: ['pdf']})
    const transactions: TransactionRecord[] = []
    const pdf_filepaths: string[] = []
    for await (const pdf_file of files) {
      pdf_filepaths.push(pdf_file.path)
    }
    pdf_filepaths.sort((a, b) => a.localeCompare(b))
    for (const filepath of pdf_filepaths) {
      const filename = path.basename(filepath)
      const pdf_text = await this.pdf_parser.parse(filepath)

      await Deno.writeTextFile(`debug-${filename}.txt`, pdf_text)

      const statement_transactions = await this.glens_falls_national_bank_parser.parse(filename, pdf_text)
      transactions.push(...statement_transactions.transactions)
    }

    transactions.sort((a, b) => b.date.getTime() - a.date.getTime())

    return transactions
  }
}
