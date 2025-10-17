import { Context } from './context.ts'
import { ChaseIngestor } from './ingestors/chase_ingestor.ts'
import { CSVOutput } from './outputs/csv_output.ts'
import { XLSXOutput } from './outputs/xlsx_output.ts'
import { GoogleSheetsOutput } from './outputs/google_sheets_output.ts'

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

  const chase_ingestor = new ChaseIngestor(context)
  const output = new GoogleSheetsOutput(context)
  const transactions = await chase_ingestor.load()
  await output.write(transactions)
}
