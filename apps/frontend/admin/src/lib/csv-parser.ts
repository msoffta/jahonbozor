import Papa from "papaparse";

export interface CsvProductRow {
    name: string;
    price: number;
    costprice: number;
    remaining: number;
}

export interface CsvParseError {
    row: number;
    message: string;
}

export interface CsvParseResult {
    products: CsvProductRow[];
    errors: CsvParseError[];
    totalRows: number;
}

/**
 * Parse CSV text matching the warehouse CSV format.
 * Handles: empty rows, header detection, comma-decimal numbers, quoted fields.
 *
 * Column mapping:
 * - Col 0: Товары (name)
 * - Col 1: Цена для клиента (price)
 * - Col 2: Себестоимость (costprice)
 * - Col 6: Остаток - second column (remaining)
 */
export function parseProductsCsv(csvText: string): CsvParseResult {
    const parsed = Papa.parse<string[]>(csvText, {
        header: false,
        skipEmptyLines: true,
        delimiter: ",",
    });

    const rows = parsed.data;
    const products: CsvProductRow[] = [];
    const errors: CsvParseError[] = [];

    // Detect header row by looking for "товар" in first cell
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        const firstCell = (rows[i][0] || "").trim().toLowerCase();
        if (firstCell.includes("товар") || firstCell === "name") {
            headerRowIndex = i;
            break;
        }
    }

    // Data starts after header (or from row 0 if no header found)
    const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    let totalRows = 0;

    for (let i = dataStartIndex; i < rows.length; i++) {
        const row = rows[i];
        const name = (row[0] || "").trim();

        // Skip rows where all cells are empty (spacer rows)
        if (row.every((cell) => !cell.trim())) continue;

        // Skip rows with empty name but count them
        if (!name) {
            totalRows++;
            continue;
        }

        totalRows++;

        const price = parseDecimalValue(row[1]);
        const costprice = parseDecimalValue(row[2]);
        const remaining = parseIntValue(row[6]);

        if (price === null || price <= 0) {
            errors.push({ row: i, message: `Invalid price: "${row[1] ?? ""}"` });
            continue;
        }

        if (costprice === null || costprice < 0) {
            errors.push({ row: i, message: `Invalid costprice: "${row[2] ?? ""}"` });
            continue;
        }

        products.push({
            name,
            price,
            costprice,
            remaining: remaining ?? 0,
        });
    }

    return { products, errors, totalRows };
}

/** Parse number that may use comma as decimal or thousands separator */
function parseDecimalValue(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = cleanNumberString(raw);
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
}

function parseIntValue(raw: string | undefined): number | null {
    if (!raw) return null;
    // Handle negative numbers
    const isNegative = raw.trim().startsWith("-");
    const cleaned = cleanNumberString(raw);
    const num = parseInt(cleaned, 10);
    if (isNaN(num)) return null;
    return isNegative && num > 0 ? -num : num;
}

function cleanNumberString(raw: string): string {
    // Remove quotes, spaces, $ signs
    let cleaned = raw.trim().replace(/"/g, "").replace(/\s/g, "").replace(/\$/g, "");

    // Handle comma: if 3+ digits after comma → thousands separator, else decimal
    const commaMatch = /^(-?\d+),(\d+)$/.exec(cleaned);
    if (commaMatch) {
        if (commaMatch[2].length >= 3) {
            // Thousands separator: "543,866" → "543866"
            cleaned = cleaned.replace(/,/g, "");
        } else {
            // Decimal separator: "2,1" → "2.1"
            cleaned = cleaned.replace(",", ".");
        }
    }

    return cleaned;
}
