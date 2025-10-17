import path from 'node:path'
import * as fs from '@std/fs'
import { ChaseParser } from "../parsers/chase_parser.ts";
import { PDFParser } from "../parsers/pdf_parser.ts";
import { Ingestor, type TransactionRecord } from "./mod.ts";
import { type Context } from "../context.ts";

export class ChaseIngestor extends Ingestor {
  pdf_parser: PDFParser
  chase_parser: ChaseParser

  constructor(ctx: Context) {
    super(ctx)
    this.pdf_parser = new PDFParser(ctx)
    this.chase_parser = new ChaseParser(ctx)
  }

  override async load(): Promise<TransactionRecord[]> {
    const chase_credit_card_folder = path.join(this.ctx.config.personal_finances_folder, 'statements', 'chase_credit_card')
    const files = fs.walk(chase_credit_card_folder, {exts: ['pdf']})
    const transactions: TransactionRecord[] = []
    const pdf_filepaths: string[] = []
    for await (const pdf_file of files) {
      pdf_filepaths.push(pdf_file.path)
    }
    pdf_filepaths.sort((a, b) => a.localeCompare(b))
    for (const filepath of pdf_filepaths) {
      const filename = path.basename(filepath)
      const pdf_text = await this.pdf_parser.parse(filepath)
      const statement_transactions = this.chase_parser.parse(filename, pdf_text)
      transactions.push(...statement_transactions.transactions)
    }

    // these are mostly sorted already, but any "FEES CHARGED" are added at the bottom of each statement
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
    // for (const tr of transactions) {
    //   console.log(tr.date)
    // }

    return transactions
  }
}
