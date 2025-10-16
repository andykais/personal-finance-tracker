import { Parser } from './mod.ts'
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

type PDFDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

interface PageResult {
  page_number: number;
  text: string;
}

/**
 * Main class for PDF to text conversion
 */
export class PDFParser extends Parser {

  /**
   * Main parsing method - orchestrates the entire process
   */
  async parse(): Promise<string> {
    const pdf_data = await this.read_pdf_file();
    const pdf_document = await this.load_pdf_document(pdf_data);
    const total_pages = this.get_page_count(pdf_document);
    const results = await this.process_all_pages(pdf_document, total_pages);
    const full_text = this.combine_results(results);
    this.print_summary(results);
    await Deno.writeTextFile('debug.txt', full_text)
    return full_text;
  }

  /**
   * Step 1: Read the PDF file from disk
   */
  private async read_pdf_file(): Promise<ArrayBuffer> {
    console.log(`📄 Reading PDF file: ${this.config.input_path}`);
    const pdf_data = await Deno.readFile(this.config.input_path);
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
    console.log(`📊 Total pages: ${total_pages}`);
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
    console.log(`\n🔄 Processing page ${page_num}/${total_pages}...`);

    try {
      const extracted_text = await this.extract_text_from_page(pdf_document, page_num);
      console.log(`  └─ ✓ Text extracted (${extracted_text.length} characters)`);
      
      return {
        page_number: page_num,
        text: extracted_text,
      };
    } catch (error) {
      return this.handle_page_error(page_num, error);
    }
  }

  /**
   * Extract text directly from a PDF page
   */
  private async extract_text_from_page(pdf_document: PDFDocument, page_num: number): Promise<string> {
    const page = await pdf_document.getPage(page_num);
    const text_content = await page.getTextContent();
    
    // Build text with proper line breaks based on y-coordinate changes
    let last_y = -1;
    const lines: string[] = [];
    let current_line = '';
    
    for (const item of text_content.items) {
      if ('str' in item && 'transform' in item) {
        const current_y = item.transform[5]; // y-coordinate
        
        // If y-coordinate changed significantly, we're on a new line
        if (last_y !== -1 && Math.abs(current_y - last_y) > 5) {
          if (current_line.trim()) {
            lines.push(current_line.trim());
          }
          current_line = item.str;
        } else {
          // Same line, add a space if needed
          if (current_line && !current_line.endsWith(' ') && item.str && !item.str.startsWith(' ')) {
            current_line += ' ';
          }
          current_line += item.str;
        }
        
        last_y = current_y;
      }
    }
    
    // Add the last line
    if (current_line.trim()) {
      lines.push(current_line.trim());
    }
    
    return lines.join('\n');
  }

  /**
   * Handle errors that occur during page processing
   */
  private handle_page_error(page_num: number, error: unknown): PageResult {
    const error_message = error instanceof Error ? error.message : String(error);
    console.error(`  └─ ✗ Error processing page ${page_num}:`, error_message);
    
    return {
      page_number: page_num,
      text: `[Error processing page ${page_num}]`,
    };
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
    console.log(`✨ Processing Complete!`);
    console.log(`   Total pages: ${results.length}`);
    console.log(`   Total characters: ${total_chars}`);
  }
}

