import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { type TransactionRecord } from "../ingestors/mod.ts";
import * as datetime from '@std/datetime'
import { Output, DATETIME_DAY_FORMAT } from "./mod.ts";


class GoogleApiClient {
  api_key_secret = 'AIzaSyAhDVW0iffuqRfvHQEYChp2Dx-gGDovLx8'

  async sheets_get(spreadsheet_id: string, sheet_id: string, ) {
    return await this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}`, {})
  }

  async fetch(url: string, options: RequestInit) {
    options.headers = {
      ...options.headers,
      'x-goog-api-key': this.api_key_secret,
    }
    const response = await fetch(url, options)
    return response
  }
}

export class GoogleSheetsOutput extends Output {
  override async write(transactions: TransactionRecord[]): Promise<void> {
    const key_file = await Deno.readTextFile(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEYS_PATH')!)
    const spreadsheet_id = Deno.env.get('SPREADSHEET_ID')!
    const key_data = JSON.parse(key_file);
    // Create JWT auth client
    const auth = new JWT({
      email: key_data.client_email,
      key: key_data.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const google_api_client = google.sheets({ version: 'v4', auth });

    const sheets = await google_api_client.spreadsheets.get({ spreadsheetId: spreadsheet_id })
    console.log({sheets})

    // const google_api_client = new GoogleApiClient(auth)

    // const response = await google_api_client.sheets_get('1pDRbpy0e6K5XqQMIc_eTs0vh5AvaeqtDP3TRdRkej_M', '1383191487')
    // console.log(response)
  }

  override filename(): string {
    throw new Error(`unexpected code path`)
  }

  override async format(transactions: TransactionRecord[]): Promise<string> {
    const lines: string[] = []
    lines.push(`Date,Name,Amount,Source`)
    for (const transaction of transactions) {
      const date = datetime.format(transaction.date, DATETIME_DAY_FORMAT)
      const csv_line = [date, transaction.name, transaction.amount, transaction.source]
        .map(column => `"${column}"`)
      lines.push(csv_line.join(','))
    }
    return lines.join('\n')
  }
}
