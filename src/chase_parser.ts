import { Parser } from './mod.ts'

const REGEX = {
  transaction_date: /(^\d\d\/\d\d)\s/,
  transaction_date_and_transaction: /^\d\d\/\d\d\s+(.+)/,
  transaction: /(?<transaction_name>.+?)\s+(?<transaction_amount>[\d.]+)$/,
}

export class ChaseParser extends Parser {
  parse(text: string) {
    let page_state: 'outside' | 'inside' = 'outside'
    let page_transaction_date: undefined | string

    const lines = text.split(/\r|\n/g)
    for (const line of lines) {
      if (line.startsWith('Transaction Merchant Name')) {
        page_state = 'inside'
      }

      if (line.startsWith('__PARSER__ ===')) {
        // is new pdf page
      }

      const transaction_date_str = line.match(REGEX.transaction_date)
      let transaction_str: string

      if (transaction_date_str !== null && transaction_date_str.length === 2) {
        page_transaction_date = transaction_date_str[0]
        console.log({page_transaction_date})
        transaction_str = line.match(REGEX.transaction_date_and_transaction)![1]
      } else {
        transaction_str = line
      }
      const transaction = transaction_str.match(REGEX.transaction)
      if (transaction === null || !transaction.groups) {
        continue
      }
      const {transaction_name, transaction_amount} = transaction.groups
      console.log(line, {page_transaction_date, transaction_str, transaction_name, transaction_amount})
      console.log()
    }
  }
}
