import { type TransactionRecord } from "../ingestors/mod.ts";
import * as datetime from '@std/datetime'
import { Output, DATETIME_DAY_FORMAT } from "./mod.ts";

export class CSVOutput extends Output {
  override filename(): string {
    return 'transactions.csv'
  }

  override async format(transactions: TransactionRecord[]): Promise<string> {
    const lines: string[] = []
    lines.push(`Date,Name,Amount,Source`)
    for (const transaction of transactions) {
      const date = datetime.format(transaction.date, DATETIME_DAY_FORMAT)
      const csv_line = [date, transaction.name, transaction.amount, transaction.source]
        .map(column => `"${column}"`)
      lines.push(csv_line.join(','))
    }
    return lines.join('\n')
  }
}
