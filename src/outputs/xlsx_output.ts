import * as XLSX from "xlsx"
import * as datetime from '@std/datetime'
import { type TransactionRecord } from "@/ingestors/mod.ts";
import { Output, DATETIME_DAY_FORMAT } from "./mod.ts";

export class XLSXOutput extends Output {
  sheet_name = 'Transactions'

  override filename(): string {
    return 'Personal Finances.xlsx'
  }

  override async format(transactions: TransactionRecord[]): Promise<Uint8Array> {
    // const xlsx_file = await this.read_xlsx(`/home/andrew/Documents/personal-finances/Personal Finances Template.xlsx`);
    const xlsx_file = await this.read_xlsx(`/home/andrew/Downloads/Personal Finances(4).xlsx`);
    // const xlsx_file = await this.read_xlsx(this.filepath());
    // this.update_transactions(xlsx_file, transactions);
    return this.write_xlsx_to_buffer(xlsx_file);
  }

  private async read_xlsx(filepath: string) {
    try {
      const file_data = await Deno.readFile(filepath);
      const workbook = XLSX.read(file_data, { 
        type: 'buffer',
        cellDates: true,
        cellStyles: true,
        cellHTML: false,
        cellFormula: true,
        bookVBA: true,
        bookDeps: true,
        // bookSheets: true,
        // bookProps: true,
      });
      // console.log('Workbook keys:', Object.keys(workbook));
      // console.log('Has SST?', !!(workbook as any).SST);
      // console.log('Has Themes?', !!(workbook as any).Themes);
      // console.log('Has Styles?', !!(workbook as any).Styles);
      return workbook;
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
        ['Date', 'Name', 'Amount', 'Source']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, this.sheet_name);
    }

    // Build new data array
    const data_rows = this.build_data_rows(transactions);

    // Update cells in-place instead of replacing the worksheet
    this.update_worksheet_cells(worksheet, data_rows);
  }

  /**
   * Update worksheet cells in-place, preserving formatting
   */
  private update_worksheet_cells(
    worksheet: XLSX.WorkSheet,
    data_rows: (string | number)[][]
  ): void {
    const current_range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Store header row styles (row 0)
    // const header_styles: { [key: number]: any } = {};
    for (let col = 0; col <= 4; col++) {
      const cell_address = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = worksheet[cell_address];
      if (col === 0 && cell.w !== 'Date') { throw new Error(`unexpected column '${cell.w}' at index ${col}`) }
      if (col === 1 && cell.w !== 'Name') { throw new Error(`unexpected column '${cell.w}' at index ${col}`) }
      if (col === 2 && cell.w !== 'Amount') { throw new Error(`unexpected column '${cell.w}' at index ${col}`) }
      if (col === 3 && cell.w !== 'Source') { throw new Error(`unexpected column '${cell.w}' at index ${col}`) }
      if (col === 4 && cell.w !== 'Category') { throw new Error(`unexpected column '${cell.w}' at index ${col}`) }
      // console.log(cell)
    }

    // Clear existing data rows (but not header at row 0)
    for (let row = 1; row <= current_range.e.r; row++) {
      for (let col = 0; col <= current_range.e.c; col++) {
        const cell_address = XLSX.utils.encode_cell({ r: row, c: col });
        delete worksheet[cell_address];
      }
    }

    // Write new data rows, starting from row 1 (after header)
    for (let row_idx = 0; row_idx < data_rows.length; row_idx++) {
      const row_data = data_rows[row_idx];
      const row_num = row_idx + 1; // +1 to skip header row

      for (let col_idx = 0; col_idx < row_data.length; col_idx++) {
        const cell_address = XLSX.utils.encode_cell({ r: row_num, c: col_idx });
        const value = row_data[col_idx];

        // Start with template cell if available (preserves formatting)
        let cell: XLSX.CellObject
        if (col_idx === 4) {
          cell = {
            t: 'n',
            f: (value as string).replace(/^=/, ''),
          }
        } else if (typeof value === 'number') {
          cell = {
            t: 'n',
            v: value
          }
        } else if (typeof value === 'string') {
          cell = {
            t: 's',
            v: value,
            w: value,
            s: {
              patternType: 'solid',
              fgColor: { rgb: "CFE2F3" },
              bgColor: { rgb: "CFE2F3" }
            }
          }
        } else {
          throw new Error(`unexpected value type ${typeof value}`)
        }
        worksheet[cell_address] = cell;
      }
    }
    // Update the worksheet range to include all new data
    const new_end_row = data_rows.length; // +1 for header row included in count
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: new_end_row, c: 4 }, // 5 columns (0-4)
    });
  }

  /**
   * Format date for display in Excel
   */
  private format_date(date: Date): string {
    return datetime.format(date, DATETIME_DAY_FORMAT);
  }

  /**
   * Build data rows with transaction data
   */
  private build_data_rows(
    transactions: TransactionRecord[]
  ): (string | number)[][] {
    const rows: (string | number)[][] = [];

    for (const [index, transaction] of transactions.entries()) {
      let row_index = index + 2
      rows.push([
        this.format_date(transaction.date),
        transaction.name,
        transaction.amount,
        transaction.source,
        `=INDEX(Rules!$A$2:$A,ARRAYFORMULA(MATCH(TRUE,ISNUMBER(SEARCH(Rules!$B$2:$B,B${row_index})),0)))`
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
      cellStyles: true,
      WTF: true,
    });
    return new Uint8Array(buffer);
  }
}
