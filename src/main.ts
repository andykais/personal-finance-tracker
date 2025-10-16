import { PDFParser } from './pdf_parser.ts'
import { ChaseParser } from './chase_parser.ts'

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = Deno.args;

  if (args.length < 1) {
    console.error("Usage: deno run --allow-read --allow-write pdf-parser.ts <input.pdf> [output.txt]");
    Deno.exit(1);
  }

  const input_path = args[0];

  try {
    const pdf_parser = new PDFParser({ input_path });
    const chase_parser = new ChaseParser({ input_path })

    const text = await pdf_parser.parse();
    const transactions = chase_parser.parse(text)
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    // Deno.exit(1);
  }
}

// Run main if this is the entry point
if (import.meta.main) {
  await main();
}

// Export for use as a module
export { PDFParser };
