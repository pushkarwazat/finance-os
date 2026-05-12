/**
 * excel-parser — parse .xlsx / .xls workbooks into structured table chunks.
 *
 * Each worksheet becomes one or more SheetChunks (paginated at MAX_CHUNK_ROWS).
 * A summary narrative is generated for the document-level chunk.
 */

import * as XLSX from "xlsx";

const MAX_CHUNK_ROWS = 500;
const PREVIEW_ROWS = 50;

const FINANCIAL_PATTERN =
  /revenue|cost|expense|profit|loss|margin|budget|forecast|actual|variance|gwp|premium|commission|ratio|amount|total|balance|payment|invoice|earned|written|ceded|reinsur|claim|reserve|ibnr|rx|dispensing|refill/i;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedSheet {
  name: string;
  rowCount: number;
  colCount: number;
  headers: string[];
  previewRows: string[][];
  hasFinancialData: boolean;
}

export interface SheetChunk {
  sheetName: string;
  globalChunkIndex: number;
  startRow: number;
  endRow: number;
  headers: string[];
  rows: string[][];
  markdownTable: string;
  hasFinancialData: boolean;
  isFirstChunkOfSheet: boolean;
}

export interface ParsedWorkbook {
  sheetNames: string[];
  sheets: ParsedSheet[];
  chunks: SheetChunk[];
  totalRows: number;
  summaryText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildMarkdown(headers: string[], rows: string[][]): string {
  if (headers.length === 0 || rows.length === 0) return "";
  const head = `| ${headers.join(" | ")} |`;
  const div = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, div, body].join("\n");
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseExcelBuffer(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    raw: false,
  });

  const sheets: ParsedSheet[] = [];
  const chunks: SheetChunk[] = [];
  let totalRows = 0;
  let globalChunkIndex = 0;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;

    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (aoa.length < 2) continue;

    // Build clean header row
    const rawHeaders = (aoa[0] as unknown[]).map(cellStr);
    const lastNonEmpty = rawHeaders.reduceRight(
      (acc, h, i) => (acc === -1 && h ? i : acc),
      -1,
    );
    const headers = rawHeaders.slice(0, lastNonEmpty + 1);
    if (headers.length === 0) continue;

    // Build data rows — skip fully empty rows
    const dataRows: string[][] = [];
    for (let ri = 1; ri < aoa.length; ri++) {
      const raw = aoa[ri] as unknown[];
      const cells = headers.map((_, ci) => cellStr(raw[ci]));
      if (cells.every((c) => !c)) continue;
      dataRows.push(cells);
    }

    if (dataRows.length === 0) continue;

    const hasFinancialData =
      headers.some((h) => FINANCIAL_PATTERN.test(h)) ||
      dataRows
        .slice(0, 20)
        .flat()
        .some((c) => /^\$?-?\d{1,3}(,\d{3})*(\.\d{0,2})?$/.test(c));

    // Paginate into chunks of MAX_CHUNK_ROWS
    let firstOfSheet = true;
    for (
      let startRow = 0;
      startRow < dataRows.length;
      startRow += MAX_CHUNK_ROWS
    ) {
      const chunkRows = dataRows.slice(startRow, startRow + MAX_CHUNK_ROWS);
      const endRow = startRow + chunkRows.length - 1;
      chunks.push({
        sheetName: name,
        globalChunkIndex: globalChunkIndex++,
        startRow,
        endRow,
        headers,
        rows: chunkRows,
        markdownTable: buildMarkdown(headers, chunkRows),
        hasFinancialData,
        isFirstChunkOfSheet: firstOfSheet,
      });
      firstOfSheet = false;
    }

    totalRows += dataRows.length;

    sheets.push({
      name,
      rowCount: dataRows.length,
      colCount: headers.length,
      headers,
      previewRows: dataRows.slice(0, PREVIEW_ROWS),
      hasFinancialData,
    });
  }

  // Build human-readable summary
  const summaryLines: string[] = [
    `Excel workbook with ${sheets.length} sheet(s) and ${totalRows} total data rows.`,
    ...sheets.map(
      (s) =>
        `Sheet "${s.name}": ${s.rowCount} rows × ${s.colCount} columns. ` +
        `Columns: ${s.headers.slice(0, 8).join(", ")}${s.headers.length > 8 ? ` +${s.headers.length - 8} more` : ""}.` +
        (s.hasFinancialData ? " Contains financial data." : ""),
    ),
  ];

  return {
    sheetNames: wb.SheetNames,
    sheets,
    chunks,
    totalRows,
    summaryText: summaryLines.join(" "),
  };
}
