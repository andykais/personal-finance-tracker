import { Context } from './context.ts'
import { ChaseIngestor } from './ingestors/chase_ingestor.ts'
import { CSVOutput } from './outputs/csv_output.ts'
import { XLSXOutput } from './outputs/xlsx_output.ts'
import { GoogleSheetsOutput } from './outputs/google_sheets_output.ts'
import { GlensFallsNationalBankIngestor } from "./ingestors/glens_falls_national_bank_ingestor.ts";
import { type TransactionRecord } from "./ingestors/mod.ts";

/**
 * Main entry point
 */
if (import.meta.main) {
  const args = Deno.args;

  if (args.length < 1) {
    console.error("Usage: deno run --allow-read --allow-write main.ts <personal_finances_folder>");
    Deno.exit(1);
  }

  const personal_finances_folder = args[0];
  const context = new Context({
    personal_finances_folder,
    log_level: 'DEBUG'
  })

  const ingestors = [
    // new ChaseIngestor(context),
    new GlensFallsNationalBankIngestor(context)
  ]
  const output = new GoogleSheetsOutput(context)

  const transactions: TransactionRecord[] = []
  for (const ingestor of ingestors) {
    context.log.info(`Ingesting ${ingestor.name} statements`)
    const ingested_transactions = await ingestor.load()
    transactions.push(...ingested_transactions)
  }
  // await output.write(transactions)
}
