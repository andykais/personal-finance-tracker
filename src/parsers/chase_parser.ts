import z from 'zod'
import * as datetime from '@std/datetime'
import { Parser } from './mod.ts'
import type { TransactionRecord, StatementRecord } from '@/ingestors/mod.ts'

const SOURCE = 'chase_credit_card'

const REGEX = {
  transaction_date: /(^\d\d\/\d\d)\s/,
  transaction_date_and_transaction: /^\d\d\/\d\d\s+(.+)/,
  transaction: /(?<transaction_name>.+?)\s+(?<transaction_amount>[\d.]+)$/,
  end_of_page: /Page \d+ of \d+/,
  statement_period: /Statement Date: (\d\d+\/\d\d\/\d\d)$/,
  filename_date: /(\d\d\d\d\d\d\d\d)-/,
}

const DATETIME_DAY_FORMAT = 'yyyy/MM/dd'

export class ChaseParser extends Parser {

  private parse_filename_date(filename: string) {
    const filename_date_match = filename.match(REGEX.filename_date)
    if (filename_date_match === null) {
      throw new Error(`No match for chase filename date`)
    }

    return datetime.parse(filename_date_match[1], 'yyyyMMdd')
  }

  private validate_statement_period(statement_date: Date, line: string): Date | undefined {
    const statement_period_match = line.match(REGEX.statement_period)
    if (statement_period_match === null || !statement_period_match[1]) {
      return
    }

    const statement_period_str = statement_period_match[1]
    const statement_period = datetime.parse(statement_period_str, 'MM/dd/yy')

    if (datetime.format(statement_period, DATETIME_DAY_FORMAT) !== datetime.format(statement_date, DATETIME_DAY_FORMAT)) {
      throw new Error(`Parsing error: statement period parsed out of pdf (${statement_period.toISOString()}) different than statement period in filename (${statement_date.toISOString()})`)
    }

    return statement_period
  }

  private parse_transaction_date(statement_date: Date, line: string): Date | undefined {
    const transaction_date_match = line.match(REGEX.transaction_date)

    if (transaction_date_match === null || transaction_date_match.length !== 2) {
      return
    }

    const transaction_date_str = transaction_date_match[1]

    let year: number
    // handle statements that start in december of the previous year
    if (statement_date.getMonth() === 0 && transaction_date_str.startsWith('12') && transaction_date_str !== '12/01') {
      year = statement_date.getFullYear() - 1
    } else {
      year = statement_date.getFullYear()
    }
    const transaction_date = datetime.parse(`${year}/${transaction_date_str}`, 'yyyy/MM/dd')
    return transaction_date
  }

  parse(filename: string, text: string): StatementRecord {
    const statement_date = this.parse_filename_date(filename)

    const transactions: TransactionRecord[] = []
    let page_state: 'outside' | 'inside_transactions' = 'outside'
    let transaction_date: undefined | Date

    const lines = text.split(/\r|\n/g)
    for (const line of lines) {

      if (line.startsWith('Transaction  Merchant Name or Transaction Description')) {
        page_state = 'inside_transactions'
      }
      if (REGEX.end_of_page.test(line)) {
        page_state = 'outside'
      }
      if (line.startsWith('__PARSER__ ===')) {
        /* new pdf page */
      }

      if (page_state === 'outside') {
        this.validate_statement_period(statement_date, line)
        continue
      }


      let transaction_str: string
      const line_transaction_date = this.parse_transaction_date(statement_date, line)
      if (line_transaction_date) {
        transaction_date = line_transaction_date
        transaction_str = line.match(REGEX.transaction_date_and_transaction)![1]
      } else {
        transaction_str = line
      }

      const transaction = transaction_str.match(REGEX.transaction)
      if (transaction === null || !transaction.groups) {
        continue
      }

      if (transaction_date === undefined) {
        throw new Error(`unexpected code path. Reached a transaction without an initial date`)
      }

      const transaction_strs = transaction.groups
      const transaction_amount = z.coerce.number().parse(transaction_strs.transaction_amount)
      const transaction_name = transaction_strs.transaction_name

      const transaction_record: TransactionRecord = {
        date: transaction_date,
        amount: transaction_amount,
        name: transaction_name,
        source: SOURCE,
      }
      transactions.push(transaction_record)
    }

    if (transactions.length === 0) {
      throw new Error(`Possible parsing error. Statment had _no_ transactions?`)
    }

    const stats = {
      transaction_count: transactions.length,
      statement_period: datetime.format(statement_date!, DATETIME_DAY_FORMAT),
      oldest_transaction_date: datetime.format(transactions.at(0)!.date, DATETIME_DAY_FORMAT),
      newest_transaction_date: datetime.format(transactions.at(-1)!.date, DATETIME_DAY_FORMAT),
      amount_total: transactions.reduce((sum, t) => t.amount + sum, 0)
    }

    this.ctx.log.info(`Parsed ${stats.transaction_count} transactions for statement period ${stats.statement_period} ($${stats.amount_total.toFixed(2)} from ${stats.oldest_transaction_date} to ${stats.newest_transaction_date})`)

    return {
      source: SOURCE,
      transactions,
      statement_period: statement_date!,
    }
  }
}
