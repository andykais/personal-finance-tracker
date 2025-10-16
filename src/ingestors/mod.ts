import { type Context } from "../context.ts";

export interface TransactionRecord {
  source: string
  date: Date
  name: string
  amount: number
}

export interface StatementRecord {
  source: string
  statement_period: Date
  transactions: TransactionRecord[]
}


export abstract class Ingestor {
  constructor(public ctx: Context) {}

  abstract load(): Promise<TransactionRecord[]>
}
