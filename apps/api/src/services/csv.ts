/**
 * CSV for Excel in German-speaking locales: `;` as separator, UTF-8 with BOM, `.` as decimal mark.
 * Cells that a spreadsheet would run as a formula are neutralised (titles come from users and from
 * imported sources, so they are untrusted).
 */
/** Byte order mark: makes Excel read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(';'));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
