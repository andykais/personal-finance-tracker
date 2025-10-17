import { type Context } from "../context.ts";
import * as datetime from '@std/datetime'

export class Parser {
  constructor(protected ctx: Context) {}

  protected convert_transaction_date(statement_date: Date, transaction_month: number, transaction_day: number): Date {
    let year: number
    // handle statements that start in december of the previous year
    if (statement_date.getMonth() === 0 && transaction_month === 12 && transaction_day !== 1) {
      year = statement_date.getFullYear() - 1
    } else {
      year = statement_date.getFullYear()
    }
    const transaction_date = datetime.parse(`${year}/${transaction_month.toString().padStart(2, '0')}/${transaction_day.toString().padStart(2, '0')}`, 'yyyy/MM/dd')
    return transaction_date
  }
}
