/**
 * Tambola Ticket Generator
 *
 * Generates valid Tambola (Housie) tickets following all standard rules:
 * - 3 rows × 9 columns grid
 * - Exactly 15 numbers, 12 blanks
 * - Exactly 5 numbers per row
 * - Each column has at least 1 number (max 3)
 * - Column ranges: Col1=1-9, Col2=10-19, ..., Col9=80-90
 * - Numbers sorted ascending within each column (top to bottom)
 */

export type TambolaTicket = (number | null)[][];

/** Column ranges: index 0 → 1-9, index 1 → 10-19, ..., index 8 → 80-90 */
const COLUMN_RANGES: [number, number][] = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];

/** Shuffle array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get all numbers available in a given column range */
function getColumnNumbers(colIndex: number): number[] {
  const [min, max] = COLUMN_RANGES[colIndex];
  const nums: number[] = [];
  for (let n = min; n <= max; n++) {
    nums.push(n);
  }
  return nums;
}

/**
 * Generate a single valid Tambola ticket.
 * Uses a two-pass approach:
 *   Pass 1: Determine how many numbers go in each column (ensuring 5 per row, ≥1 per col)
 *   Pass 2: Pick random numbers from the column ranges and sort them
 */
export function generateTicket(): TambolaTicket {
  // Retry loop — the constraint solver occasionally paints itself into a corner
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = tryGenerateTicket();
    if (result) return result;
  }
  throw new Error('Failed to generate a valid ticket after 100 attempts');
}

function tryGenerateTicket(): TambolaTicket | null {
  // --- Pass 1: Build the layout (which cells have numbers) ---
  // layout[row][col] = true means this cell will have a number
  const layout: boolean[][] = Array.from({ length: 3 }, () =>
    Array(9).fill(false)
  );

  // Each column must have at least 1 number (across 3 rows)
  // Each row must have exactly 5 numbers
  // Total: 15 numbers across 27 cells

  // Step 1: Determine how many numbers per column (total = 15)
  // Each column gets at least 1, max 3
  const colCounts = new Array(9).fill(1); // Start with 1 each = 9
  let remaining = 15 - 9; // 6 more to distribute

  // Randomly add more to columns (max 3 per col)
  const colIndices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (const ci of colIndices) {
    if (remaining <= 0) break;
    const canAdd = Math.min(2, remaining); // max 2 more (to reach 3)
    const toAdd = Math.floor(Math.random() * (canAdd + 1));
    colCounts[ci] += toAdd;
    remaining -= toAdd;
  }

  // If we still have remaining, distribute them
  while (remaining > 0) {
    for (let c = 0; c < 9 && remaining > 0; c++) {
      if (colCounts[c] < 3) {
        colCounts[c]++;
        remaining--;
      }
    }
  }

  // Step 2: For each column, decide which rows get numbers
  for (let col = 0; col < 9; col++) {
    const count = colCounts[col];
    const rows = shuffle([0, 1, 2]).slice(0, count);
    for (const row of rows) {
      layout[row][col] = true;
    }
  }

  // Step 3: Adjust rows to have exactly 5 numbers each
  for (let row = 0; row < 3; row++) {
    let rowCount = layout[row].filter(Boolean).length;

    // Remove excess
    while (rowCount > 5) {
      const filledCols = [];
      for (let c = 0; c < 9; c++) {
        if (layout[row][c] && colCounts[c] > 1) {
          filledCols.push(c);
        }
      }
      if (filledCols.length === 0) return null; // Can't fix — retry
      const removeCol = filledCols[Math.floor(Math.random() * filledCols.length)];
      layout[row][removeCol] = false;
      colCounts[removeCol]--;
      rowCount--;
    }

    // Add missing
    while (rowCount < 5) {
      const emptyCols = [];
      for (let c = 0; c < 9; c++) {
        if (!layout[row][c] && colCounts[c] < 3) {
          emptyCols.push(c);
        }
      }
      if (emptyCols.length === 0) return null; // Can't fix — retry
      const addCol = emptyCols[Math.floor(Math.random() * emptyCols.length)];
      layout[row][addCol] = true;
      colCounts[addCol]++;
      rowCount++;
    }
  }

  // Validate: each column should still have ≥ 1
  for (let c = 0; c < 9; c++) {
    const count = layout[0][c] ? 1 : 0 + (layout[1][c] ? 1 : 0) + (layout[2][c] ? 1 : 0);
    if (count === 0) return null;
  }

  // --- Pass 2: Fill in the numbers ---
  const ticket: TambolaTicket = Array.from({ length: 3 }, () =>
    Array(9).fill(null)
  );

  for (let col = 0; col < 9; col++) {
    const rowsWithNumber: number[] = [];
    for (let row = 0; row < 3; row++) {
      if (layout[row][col]) rowsWithNumber.push(row);
    }

    // Pick random numbers from the column range
    const available = shuffle(getColumnNumbers(col));
    const picked = available.slice(0, rowsWithNumber.length).sort((a, b) => a - b);

    // Assign sorted numbers to rows (top to bottom)
    rowsWithNumber.sort((a, b) => a - b);
    for (let i = 0; i < rowsWithNumber.length; i++) {
      ticket[rowsWithNumber[i]][col] = picked[i];
    }
  }

  return ticket;
}

/**
 * Generate multiple unique tickets for a game.
 * Each ticket is guaranteed to be structurally unique.
 */
export function generateTickets(count: number): TambolaTicket[] {
  const tickets: TambolaTicket[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let ticket: TambolaTicket;
    let key: string;
    let attempts = 0;

    do {
      ticket = generateTicket();
      key = JSON.stringify(ticket);
      attempts++;
      if (attempts > 1000) {
        throw new Error(`Could not generate unique ticket #${i + 1}`);
      }
    } while (seen.has(key));

    seen.add(key);
    tickets.push(ticket);
  }

  return tickets;
}

/**
 * Validate that a ticket follows all Tambola rules.
 * Useful for testing and debugging.
 */
export function validateTicket(ticket: TambolaTicket): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (ticket.length !== 3) {
    errors.push(`Expected 3 rows, got ${ticket.length}`);
    return { valid: false, errors };
  }

  for (let row = 0; row < 3; row++) {
    if (ticket[row].length !== 9) {
      errors.push(`Row ${row}: expected 9 columns, got ${ticket[row].length}`);
    }
    const numCount = ticket[row].filter((n) => n !== null).length;
    if (numCount !== 5) {
      errors.push(`Row ${row}: expected 5 numbers, got ${numCount}`);
    }
  }

  // Check total numbers
  const allNumbers = ticket.flat().filter((n): n is number => n !== null);
  if (allNumbers.length !== 15) {
    errors.push(`Expected 15 total numbers, got ${allNumbers.length}`);
  }

  // Check column ranges
  for (let col = 0; col < 9; col++) {
    const [min, max] = COLUMN_RANGES[col];
    const colNums: number[] = [];
    for (let row = 0; row < 3; row++) {
      const val = ticket[row][col];
      if (val !== null) {
        if (val < min || val > max) {
          errors.push(`Col ${col}: number ${val} outside range [${min}, ${max}]`);
        }
        colNums.push(val);
      }
    }

    if (colNums.length === 0) {
      errors.push(`Col ${col}: must have at least 1 number`);
    }

    // Check ascending order within column
    for (let i = 1; i < colNums.length; i++) {
      if (colNums[i] <= colNums[i - 1]) {
        errors.push(`Col ${col}: numbers not in ascending order`);
      }
    }
  }

  // Check no duplicates
  const unique = new Set(allNumbers);
  if (unique.size !== allNumbers.length) {
    errors.push('Duplicate numbers found');
  }

  return { valid: errors.length === 0, errors };
}
