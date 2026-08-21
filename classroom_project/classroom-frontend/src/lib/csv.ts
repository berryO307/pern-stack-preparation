// Minimal RFC 4180 CSV parser — handles quoted fields, embedded commas/newlines,
// and "" escaped quotes. No external dependency for a feature this small.
export function parseCsv(text: string): Record<string, string>[] {
  // Remove UTF-8 BOM if present
  const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // swallow, \n (or end of input) handles the row break
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (nonEmptyRows.length === 0) return [];

  const header = nonEmptyRows[0]!.map((h) => h.trim());
  return nonEmptyRows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}
