import * as XLSX from "xlsx"
import { type TransactionRecord } from "@/ingestors/mod.ts";
import * as datetime from '@std/datetime'
import { Output, DATETIME_DAY_FORMAT } from "./mod.ts";

export class XLSXOutput extends Output {
  sheet_name = 'Transactions'

  override filename(): string {
    return 'Personal Finances.xlsx'
  }

  override async format(transactions: TransactionRecord[]): Promise<Uint8Array> {
    const xlsx_file = await this.read_xlsx(this.filepath());
    this.update_transactions(xlsx_file, transactions);
    return this.write_xlsx_to_buffer(xlsx_file);
  }

  private async read_xlsx(filepath: string) {
    try {
    const file_data = await Deno.readFile(filepath);
    return XLSX.read(file_data, { 
      type: 'buffer',
      cellDates: true,
      cellStyles: true,
    });
    } catch (e) {
      // TODO handle seeding an empty xlsx document
      throw e
    }
  }

 /**
   * Update the Transactions sheet with new transaction data
   */
  private update_transactions(workbook: XLSX.WorkBook, transactions: TransactionRecord[]): void {
    // Get or create the Transactions sheet
    let worksheet = workbook.Sheets[this.sheet_name];
    
    if (!worksheet) {
      worksheet = XLSX.utils.aoa_to_sheet([
        ['Index', 'Source', 'Date', 'Name', 'Amount']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, this.sheet_name);
    }

    // Extract the first column (preserve existing indices/IDs)
    const first_column = this.extract_first_column(worksheet);

    // Build new data array with preserved first column
    const data_rows = this.build_data_rows(first_column, transactions);

    // Create new worksheet with updated data
    const new_worksheet = XLSX.utils.aoa_to_sheet([
      ['Index', 'Source', 'Date', 'Name', 'Amount'],
      ...data_rows
    ]);

    // Replace the worksheet in the workbook
    workbook.Sheets[this.sheet_name] = new_worksheet;
  }

  /**
   * Extract the first column from the worksheet (preserving indices)
   */
  private extract_first_column(worksheet: XLSX.WorkSheet): (string | number)[] {
    const first_column: (string | number)[] = [];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Skip header row (start at 1)
    for (let row = 1; row <= range.e.r; row++) {
      const cell_address = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = worksheet[cell_address];
      
      if (cell && cell.v !== undefined) {
        first_column.push(cell.v);
      }
    }
    
    return first_column;
  }

  /**
   * Build data rows with preserved first column and transaction data
   */
  private build_data_rows(
    first_column: (string | number)[],
    transactions: TransactionRecord[]
  ): (string | number | Date)[][] {
    const rows: (string | number | Date)[][] = [];

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      // Use existing index if available, otherwise create new one
      const index = i < first_column.length ? first_column[i] : i + 1;
      
      rows.push([
        index,
        transaction.source,
        transaction.date,
        transaction.name,
        transaction.amount,
      ]);
    }

    return rows;
  }

  /**
   * Write workbook to buffer
   */
  private write_xlsx_to_buffer(workbook: XLSX.WorkBook): Uint8Array {
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    return new Uint8Array(buffer);
  }
}
