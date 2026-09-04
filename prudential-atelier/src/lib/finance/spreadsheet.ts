function escapeCsv(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))];
  return `\uFEFF${lines.join("\r\n")}`;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel 2003 XML — opens in Excel as a workbook without an extra package. */
export function toExcelXml(sheetName: string, headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return `<Cell ss:StyleID="n"><Data ss:Type="Number">${v}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${xmlEscape(String(v ?? ""))}</Data></Cell>`;
  };
  const headerRow = `<Row ss:StyleID="h">${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join("")}</Row>`;
  const body = rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="h"><Font ss:Bold="1"/></Style>
  <Style ss:ID="n"><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}">
  <Table>${headerRow}${body}</Table>
 </Worksheet>
</Workbook>`;
}
