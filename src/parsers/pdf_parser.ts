import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { Parser } from './mod.ts'

type PDFDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

interface PDFParserConfig {
  input_path: string
}

interface PageResult {
  page_number: number;
  text: string;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Main class for PDF to text conversion
 */
export class PDFParser extends Parser {

  /**
   * Main parsing method - orchestrates the entire process
   */
  async parse(input_path: string): Promise<string> {
    const pdf_data = await this.read_pdf_file(input_path);
    const pdf_document = await this.load_pdf_document(pdf_data);
    const total_pages = this.get_page_count(pdf_document);
    const results = await this.process_all_pages(pdf_document, total_pages);
    const full_text = this.combine_results(results);
    await Deno.writeTextFile('debug.txt', full_text)
    this.print_summary(results);
    return full_text;
  }

  /**
   * Step 1: Read the PDF file from disk
   */
  private async read_pdf_file(input_path: string): Promise<ArrayBuffer> {
    this.ctx.log.debug(`Reading PDF file: ${input_path}`);
    const pdf_data = await Deno.readFile(input_path);
    return pdf_data.buffer;
  }

  /**
   * Step 2: Load the PDF document
   */
  private async load_pdf_document(pdf_data: ArrayBuffer): Promise<PDFDocument> {
    const loading_task = pdfjsLib.getDocument({
      data: new Uint8Array(pdf_data),
      useSystemFonts: true,
    });
    return await loading_task.promise;
  }

  /**
   * Step 3: Get total page count from PDF
   */
  private get_page_count(pdf_document: PDFDocument): number {
    const total_pages = pdf_document.numPages;
    this.ctx.log.debug(`Total pages: ${total_pages}`);
    return total_pages;
  }

  /**
   * Step 4: Process all pages sequentially
   */
  private async process_all_pages(pdf_document: PDFDocument, total_pages: number): Promise<PageResult[]> {
    const results: PageResult[] = [];

    for (let page_num = 1; page_num <= total_pages; page_num++) {
      const result = await this.process_single_page(pdf_document, page_num, total_pages);
      results.push(result);
    }

    return results;
  }

  /**
   * Process a single PDF page
   */
  private async process_single_page(
    pdf_document: PDFDocument,
    page_num: number,
    total_pages: number
  ): Promise<PageResult> {
    this.ctx.log.debug(`\nProcessing page ${page_num}/${total_pages}...`);

    try {
      const extracted_text = await this.extract_text_from_page(pdf_document, page_num);
      this.ctx.log.debug(`  └─ ✓ Text extracted (${extracted_text.length} characters)`);
      
      return {
        page_number: page_num,
        text: extracted_text,
      };
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      console.error(`  └─ ✗ Error processing page ${page_num}:`, error_message);
      throw error
    }
  }

  /**
   * Extract text directly from a PDF page
   */
  private async extract_text_from_page(pdf_document: PDFDocument, page_num: number): Promise<string> {
    const page = await pdf_document.getPage(page_num);
    const text_content = await page.getTextContent();
    
    // Extract all text items with their positions
    const text_items: TextItem[] = [];
    
    for (const item of text_content.items) {
      if ('str' in item && 'transform' in item) {
        text_items.push({
          str: item.str,
          x: item.transform[4], // x-coordinate
          y: item.transform[5], // y-coordinate
        });
      }
    }
    
    // Sort items by reading order: top to bottom (descending y), then left to right (ascending x)
    text_items.sort((a, b) => {
      // Sort by y-coordinate first (top to bottom, so higher y values first)
      const y_diff = b.y - a.y;
      if (Math.abs(y_diff) > 5) { // 5 pixel threshold for same line
        return y_diff;
      }
      // If on same line, sort by x-coordinate (left to right)
      return a.x - b.x;
    });
    
    // Build lines by grouping items with similar y-coordinates
    const lines: string[] = [];
    let current_line: TextItem[] = [];
    let last_y = -1;
    
    for (const item of text_items) {
      // Check if we're on a new line
      if (last_y !== -1 && Math.abs(item.y - last_y) > 5) {
        // Finish current line
        if (current_line.length > 0) {
          lines.push(this.build_line_text(current_line));
          current_line = [];
        }
      }
      
      current_line.push(item);
      last_y = item.y;
    }
    
    // Add the last line
    if (current_line.length > 0) {
      lines.push(this.build_line_text(current_line));
    }
    
    return lines.join('\n');
  }

  /**
   * Build text from items on the same line
   */
  private build_line_text(line_items: TextItem[]): string {
    // Items are already sorted by x-coordinate from extract_text_from_page
    let result = '';
    let last_x = -1;

    for (const item of line_items) {
      // Add spacing between text items if there's a significant gap
      if (last_x !== -1 && item.x - last_x > 10) {
        result += ' ';
      }

      result += item.str;
      last_x = item.x + (item.str.length * 5); // Rough estimate of text width
    }
    
    return result.trim();
  }

  /**
   * Step 5: Combine all page results into a single text
   */
  private combine_results(results: PageResult[]): string {
    const full_text = results
      .map((r) => `__PARSER__ === Page ${r.page_number} ===\n${r.text}`)
      .join("\n");

    return full_text;
  }

  /**
   * Step 7: Print summary statistics
   */
  private print_summary(results: PageResult[]): void {
    const total_chars = results.reduce((sum, r) => sum + r.text.length, 0);
    this.ctx.log.debug(`Processing Complete!`);
    this.ctx.log.debug(`   Total pages: ${results.length}`);
    this.ctx.log.debug(`   Total characters: ${total_chars}`);
  }
}
