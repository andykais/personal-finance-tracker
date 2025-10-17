import z from 'zod'
import * as datetime from '@std/datetime'
import { Parser } from './mod.ts'
import type { TransactionRecord, StatementRecord } from '@/ingestors/mod.ts'

const SOURCE = 'glens_falls_national_bank'

const REGEX = {
  filename_date: /(?<month>[A-Za-z]+)[+](?<day>\d+),[+](?<year>\d\d\d\d)[.]pdf/,
  transaction: /(?<month>[A-Za-z]+) (?<day>\d+) (?<name>.+)(?<kind_indicator>\s+)(?<amount>[\d,]+[.]\d+)\s+(?<balance>[\d,]+[.]\d+)/
}

const MONTH_MAPPER = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
}
type MonthShorthand = keyof typeof MONTH_MAPPER
const MonthShorthands = Object.keys(MONTH_MAPPER) as MonthShorthand[]
const MonthValidator = z.enum(MonthShorthands).transform(shorthand => MONTH_MAPPER[shorthand])
const DATETIME_DAY_FORMAT = 'yyyy/MM/dd'

const CurrencyValidator = z.string().transform(str => str.replace(',', '')).pipe(z.coerce.number())

export class GlensFallsNationalBankParser extends Parser {

  private parse_filename_date(filename: string) {
    const filename_match = filename.match(REGEX.filename_date)
    if (filename_match) {
      const month = MonthValidator.parse(filename_match.groups!.month)
      const day = z.coerce.number().parse(filename_match.groups!.day)
      const year = z.coerce.number().parse(filename_match.groups!.year)
      return datetime.parse(`${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`, DATETIME_DAY_FORMAT)
    }
    throw new Error(`Unable to parse date from statement filename '${filename}'`)
  }

  private parse_transaction_date(statement_date: Date, line: string): Date | undefined {
    throw new Error(`unimplemented`)
  }

  parse(filename: string, text: string): StatementRecord {
    const statement_date = this.parse_filename_date(filename)
    const transactions: TransactionRecord[] = []

    let line_index = -1 // start at -1 because we increment the line count at the top of the while loop instead of the bottom
    let page_state: 'outside' | 'inside_transactions' = 'outside'
    const lines = text.split(/\n|\r/)
    let prev_read_transaction_row = false
    while (line_index + 1 < lines.length) {
      line_index++

      const line = lines[line_index]

      if (line_index + 1 < lines.length && lines[line_index + 1].startsWith('__PARSER__')) {
        page_state = 'outside'
        prev_read_transaction_row = false
        // the bottom page of a page has a garble of numbers and letters that we do not want counted towards out transactions
        continue
      }

      if (line.startsWith('FEE RECAP')) {
        page_state = 'outside'
        prev_read_transaction_row = false
        continue
      }

      if (line.startsWith('MISCELLANEOUS DEBITS & CREDITS')) {
        page_state = 'inside_transactions'
        line_index ++ // advance past the table header "Date Description  Deposits  Withdrawals  Balance"
        prev_read_transaction_row = false
        continue
      }

      if (page_state !== 'inside_transactions') {
        prev_read_transaction_row = false
        continue
      }
   
      if (line.includes('BEGINNING BALANCE')) {
        prev_read_transaction_row = false
        // this appears inside the transaction block, so we should skip it for now. It may be useful later
        continue
      }
      if (line.includes('ENDING BALANCE')) {
        prev_read_transaction_row = false
        // this appears inside the transaction block, so we should skip it for now. It may be useful later
        continue
      }

      console.log({line})

      const month_shorthand = MonthShorthands.find(shorthand => line.startsWith(shorthand))
      if (month_shorthand) {
        const transaction_match = line.match(REGEX.transaction)
        if (transaction_match?.groups) {
          // console.log(transaction_match.groups)
          const transaction_month = MonthValidator.parse(transaction_match.groups.month)
          const transaction_day = z.coerce.number().parse(transaction_match.groups.day)
          const transaction_name = z.string().parse(transaction_match.groups.name)
          let transaction_amount = CurrencyValidator.parse(transaction_match.groups.amount)
          if (transaction_match.groups.kind_indicator === "   ") {
            // three spaces indicates this is from the Withdrawal column (and the Deposit column is empty)
            transaction_amount *= -1
          } else if (transaction_match.groups.kind_indicator === ' '){
            // this indicates it is a deposit. We do not need to change the amount for this
          } else {
            throw new Error(`Could not determine which column the amount ${transaction_amount} was from in line:\n${line}`)
          }
          const balance = CurrencyValidator.parse(transaction_match.groups.balance)
          // console.log({transaction_month, transaction_day, transaction_name, transaction_amount, balance})
          const transaction_record: TransactionRecord = {
            name: transaction_name,
            date: this.convert_transaction_date(statement_date, transaction_month, transaction_day),
            amount: transaction_amount,
            source: SOURCE,
          }
          transactions.push(transaction_record)
          prev_read_transaction_row = true
        } else {
          throw new Error(`unexpected code path. Found line in transaction part of page that started with month but did not match regex:\n${line}`)
        }
      } else {
        if (transactions.length === 0) {
          throw new Error(`unexpected code path. Found transaction cutover without any transactions written yet`)
        }
        transactions.at(-1)!.name += ' ' + line
        prev_read_transaction_row = false
      }

      line_index++
    }
    console.log(statement_date)
    const stats = {
      statement_period: statement_date,
      transaction_count: transactions.length,
      amount_total: -1,
      newest_transaction_date: 'unknown',
      oldest_transaction_date: 'unknown',
    }
    this.ctx.log.info(`Parsed ${stats.transaction_count} transactions for statement period ${stats.statement_period} ($${stats.amount_total.toFixed(2)} from ${stats.oldest_transaction_date} to ${stats.newest_transaction_date})`)
    throw new Error(`unimplemented`)
  }
}
