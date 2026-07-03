/**
 * Tambola Sheet Generator
 *
 * Generates valid Tambola (Housie) sheets following all standard rules:
 *
 * FULL SHEET: 6 tickets containing ALL numbers 1–90 exactly once.
 *   - 6 tickets × 15 numbers = 90 numbers
 *   - Every called number will appear on exactly one ticket in the sheet
 *
 * HALF SHEET: 3 tickets (one half of a full sheet).
 *   - 3 tickets × 15 numbers = 45 numbers
 *   - Two half sheets together cover all 90 numbers
 *
 * Each individual ticket follows standard rules:
 *   - 3 rows × 9 columns grid
 *   - Exactly 15 numbers, 12 blanks
 *   - Exactly 5 numbers per row
 *   - Each column has at least 1 number (max 3)
 *   - Column ranges: Col1=1-9, Col2=10-19, ..., Col9=80-90
 *   - Numbers sorted ascending within each column (top to bottom)
 */

export type TambolaTicket = (number | null)[][];

export type SheetType = 'full' | 'half';

export interface TambolaSheet {
  type: SheetType;
  tickets: TambolaTicket[];
}

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

/** Number of values in each column range */
const COLUMN_SIZES = [9, 10, 10, 10, 10, 10, 10, 10, 11]; // total = 90

/** Shuffle array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get all numbers in a given column range */
function getColumnNumbers(colIndex: number): number[] {
  const [min, max] = COLUMN_RANGES[colIndex];
  const nums: number[] = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return nums;
}

/**
 * ============================================================
 * FULL SHEET GENERATOR
 * Generates 6 tickets where all 90 numbers appear exactly once.
 * ============================================================
 *
 * Algorithm:
 *  Phase 1 — Distribute all numbers in each column across 6 tickets.
 *    For each column, take all numbers (e.g. 1–9 for col 0),
 *    shuffle them, and assign them to tickets such that:
 *      - Each ticket gets 1, 2, or 3 numbers per column
 *      - Each ticket ends up with exactly 15 numbers total
 *
 *  Phase 2 — For each ticket, arrange its assigned numbers into a 3×9 grid.
 *    - Decide which rows each column's numbers go into
 *    - Ensure each row has exactly 5 numbers
 *    - Sort numbers ascending within each column
 */
export function generateFullSheet(): TambolaSheet {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = tryGenerateFullSheet();
    if (result) return { type: 'full', tickets: result };
  }
  throw new Error('Failed to generate a valid full sheet after 200 attempts');
}

function tryGenerateFullSheet(): TambolaTicket[] | null {
  // Phase 1: Distribute column numbers across 6 tickets
  // ticketColNums[ticket][col] = array of numbers assigned to that ticket's column
  const ticketColNums: number[][][] = Array.from({ length: 6 }, () =>
    Array.from({ length: 9 }, () => [])
  );

  // For each column, determine how many numbers each ticket gets
  // Constraints:
  //  - Each ticket: 1-3 numbers per column (but can be 0 if we allow it, then ≥1 overall)
  //  - Total across 6 tickets = column size (9, 10, or 11)
  //  - Each ticket must end up with exactly 15 numbers total

  // Track total numbers assigned to each ticket
  const ticketTotals = new Array(6).fill(0);

  for (let col = 0; col < 9; col++) {
    const allNums = shuffle(getColumnNumbers(col));
    const colSize = allNums.length; // 9, 10, or 11

    // Determine distribution: how many numbers each of the 6 tickets gets from this column
    // Each ticket can get 0, 1, 2, or 3 numbers from a column
    // But across all columns, each ticket must total exactly 15
    // And every column on a ticket must have ≥1 number? No — in the sheet system,
    // individual tickets CAN have 0 numbers in a column (empty column is allowed
    // as long as the sheet constraint is met). Wait — standard Tambola rules say
    // each column must have at least 1 number. Let me enforce ≥1 per ticket per column.
    //
    // Actually, with 6 tickets × 9 columns, each ticket needs 15 numbers.
    // Col sizes range from 9 to 11. If we require every ticket to have ≥1 in every column,
    // that's 9 numbers minimum per ticket just for the "at least 1" rule, leaving only
    // 6 more to distribute. 6 tickets × 9 mandatory = 54, and 90 - 54 = 36 extras to spread.
    //
    // But col 0 only has 9 numbers for 6 tickets — that means some tickets CANNOT have
    // a number in col 0. So individual tickets in a sheet do NOT require ≥1 in every column.
    // The standard "≥1 per column" rule applies to standalone tickets, not sheet tickets.
    //
    // For sheets: a column CAN be empty on a ticket. The "5 per row" rule still applies.

    // Distribute: assign numbers greedily to tickets that still have room
    // First, give each ticket at least 0 or 1 from this column, then extras
    const distribution = new Array(6).fill(0);

    // Shuffle ticket order to avoid bias
    const ticketOrder = shuffle([0, 1, 2, 3, 4, 5]);

    // Step 1: Give 1 number to each ticket until we run out or all have 1
    let assigned = 0;
    for (const t of ticketOrder) {
      if (assigned >= colSize) break;
      if (ticketTotals[t] + 1 <= 15) {
        distribution[t] = 1;
        assigned++;
      }
    }

    // Step 2: Give extra numbers (up to 3 per ticket)
    while (assigned < colSize) {
      let placed = false;
      for (const t of shuffle([...ticketOrder])) {
        if (assigned >= colSize) break;
        if (distribution[t] < 3 && ticketTotals[t] + distribution[t] + 1 <= 15) {
          distribution[t]++;
          assigned++;
          placed = true;
        }
      }
      if (!placed) return null; // Can't distribute — retry
    }

    // Now assign actual numbers
    let numIdx = 0;
    for (let t = 0; t < 6; t++) {
      const count = distribution[t];
      const nums = allNums.slice(numIdx, numIdx + count).sort((a, b) => a - b);
      ticketColNums[t][col] = nums;
      ticketTotals[t] += count;
      numIdx += count;
    }
  }

  // Validate totals
  for (let t = 0; t < 6; t++) {
    if (ticketTotals[t] !== 15) return null;
  }

  // Phase 2: Arrange each ticket's numbers into a 3×9 grid
  const tickets: TambolaTicket[] = [];
  for (let t = 0; t < 6; t++) {
    const ticket = arrangeTicketGrid(ticketColNums[t]);
    if (!ticket) return null;
    tickets.push(ticket);
  }

  return tickets;
}

/**
 * Arrange a set of column-assigned numbers into a valid 3×9 ticket grid.
 * colNums[col] = sorted array of numbers for that column (0–3 numbers).
 * Each row must have exactly 5 numbers.
 */
function arrangeTicketGrid(colNums: number[][]): TambolaTicket | null {
  // Determine which rows each column's numbers go into
  // layout[row][col] = true if there's a number there
  const layout: boolean[][] = Array.from({ length: 3 }, () => Array(9).fill(false));

  const colCounts = colNums.map((nums) => nums.length);

  // Assign rows for each column
  for (let col = 0; col < 9; col++) {
    const count = colCounts[col];
    if (count === 0) continue;
    if (count === 3) {
      // All 3 rows
      layout[0][col] = true;
      layout[1][col] = true;
      layout[2][col] = true;
    } else {
      // Pick 'count' random rows
      const rows = shuffle([0, 1, 2]).slice(0, count);
      for (const r of rows) layout[r][col] = true;
    }
  }

  // Adjust rows to have exactly 5 numbers each
  for (let row = 0; row < 3; row++) {
    let rowCount = layout[row].filter(Boolean).length;

    // Remove excess
    let maxIter = 50;
    while (rowCount > 5 && maxIter-- > 0) {
      const removable: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (layout[row][c] && colCounts[c] > 1) {
          // Check: can we move this number to another row?
          const otherRows = [0, 1, 2].filter((r) => r !== row);
          for (const or of otherRows) {
            const orCount = layout[or].filter(Boolean).length;
            if (!layout[or][c] && orCount < 5) {
              removable.push(c);
              break;
            }
          }
        }
      }
      if (removable.length === 0) {
        // Just remove from columns with count > 1
        const fallback: number[] = [];
        for (let c = 0; c < 9; c++) {
          if (layout[row][c] && colCounts[c] > 1) fallback.push(c);
        }
        if (fallback.length === 0) return null;
        const rc = fallback[Math.floor(Math.random() * fallback.length)];
        // Move to another row
        const otherRows = shuffle([0, 1, 2].filter((r) => r !== row));
        let moved = false;
        for (const or of otherRows) {
          const orCount = layout[or].filter(Boolean).length;
          if (!layout[or][rc] && orCount < 5) {
            layout[row][rc] = false;
            layout[or][rc] = true;
            moved = true;
            break;
          }
        }
        if (!moved) {
          layout[row][rc] = false;
          colCounts[rc]--;
          // This breaks the constraint — retry the whole sheet
          return null;
        }
        rowCount--;
      } else {
        const rc = removable[Math.floor(Math.random() * removable.length)];
        const otherRows = shuffle([0, 1, 2].filter((r) => r !== row));
        for (const or of otherRows) {
          const orCount = layout[or].filter(Boolean).length;
          if (!layout[or][rc] && orCount < 5) {
            layout[row][rc] = false;
            layout[or][rc] = true;
            break;
          }
        }
        rowCount--;
      }
    }

    // Add missing
    maxIter = 50;
    while (rowCount < 5 && maxIter-- > 0) {
      const addable: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (!layout[row][c] && colCounts[c] > 0) {
          // Check if this column has a number in another row that can be moved here
          const otherRows = [0, 1, 2].filter((r) => r !== row);
          for (const or of otherRows) {
            const orCount = layout[or].filter(Boolean).length;
            if (layout[or][c] && orCount > 5) {
              addable.push(c);
              break;
            }
          }
        }
      }

      // If we can't steal from over-filled rows, just add from any column that has numbers
      // in other rows and those rows have > 5 or can spare
      if (addable.length === 0) {
        // Find columns with numbers in other rows we can "move" here
        for (let c = 0; c < 9; c++) {
          if (!layout[row][c]) {
            for (const or of [0, 1, 2].filter((r) => r !== row)) {
              if (layout[or][c]) {
                const orCount = layout[or].filter(Boolean).length;
                if (orCount > 5) {
                  layout[or][c] = false;
                  layout[row][c] = true;
                  rowCount++;
                  break;
                }
              }
            }
          }
          if (rowCount >= 5) break;
        }
        if (rowCount < 5) return null;
      } else {
        const ac = addable[Math.floor(Math.random() * addable.length)];
        const otherRows = [0, 1, 2].filter((r) => r !== row);
        for (const or of otherRows) {
          if (layout[or][ac]) {
            const orCount = layout[or].filter(Boolean).length;
            if (orCount > 5) {
              layout[or][ac] = false;
              layout[row][ac] = true;
              rowCount++;
              break;
            }
          }
        }
      }
    }

    if (rowCount !== 5) return null;
  }

  // Final validation: each row has exactly 5
  for (let row = 0; row < 3; row++) {
    if (layout[row].filter(Boolean).length !== 5) return null;
  }

  // Build the ticket grid
  const ticket: TambolaTicket = Array.from({ length: 3 }, () => Array(9).fill(null));

  for (let col = 0; col < 9; col++) {
    const nums = colNums[col]; // already sorted
    const rowsWithNumber: number[] = [];
    for (let row = 0; row < 3; row++) {
      if (layout[row][col]) rowsWithNumber.push(row);
    }
    rowsWithNumber.sort((a, b) => a - b);

    // Verify counts match
    if (rowsWithNumber.length !== nums.length) return null;

    for (let i = 0; i < nums.length; i++) {
      ticket[rowsWithNumber[i]][col] = nums[i];
    }
  }

  return ticket;
}

/**
 * Generate a HALF SHEET (3 tickets).
 * Takes the first 3 tickets of a full sheet.
 */
export function generateHalfSheet(): TambolaSheet {
  const fullSheet = generateFullSheet();
  return {
    type: 'half',
    tickets: fullSheet.tickets.slice(0, 3),
  };
}

/**
 * Generate a sheet based on the specified type.
 */
export function generateSheet(type: SheetType): TambolaSheet {
  if (type === 'full') return generateFullSheet();
  return generateHalfSheet();
}

/**
 * Generate multiple full sheets for a game (one per player).
 * Each full sheet is independently generated.
 */
export function generateSheetsForGame(playerCount: number, sheetType: SheetType): TambolaSheet[] {
  const sheets: TambolaSheet[] = [];
  for (let i = 0; i < playerCount; i++) {
    sheets.push(generateSheet(sheetType));
  }
  return sheets;
}

/**
 * Legacy: Generate a single standalone ticket (not part of a sheet).
 * Kept for backward compatibility and testing.
 */
export function generateTicket(): TambolaTicket {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = tryGenerateStandaloneTicket();
    if (result) return result;
  }
  throw new Error('Failed to generate a valid ticket after 100 attempts');
}

function tryGenerateStandaloneTicket(): TambolaTicket | null {
  const layout: boolean[][] = Array.from({ length: 3 }, () => Array(9).fill(false));
  const colCounts = new Array(9).fill(1);
  let remaining = 15 - 9;

  const colIndices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (const ci of colIndices) {
    if (remaining <= 0) break;
    const canAdd = Math.min(2, remaining);
    const toAdd = Math.floor(Math.random() * (canAdd + 1));
    colCounts[ci] += toAdd;
    remaining -= toAdd;
  }
  while (remaining > 0) {
    for (let c = 0; c < 9 && remaining > 0; c++) {
      if (colCounts[c] < 3) { colCounts[c]++; remaining--; }
    }
  }

  for (let col = 0; col < 9; col++) {
    const count = colCounts[col];
    const rows = shuffle([0, 1, 2]).slice(0, count);
    for (const row of rows) layout[row][col] = true;
  }

  for (let row = 0; row < 3; row++) {
    let rowCount = layout[row].filter(Boolean).length;
    while (rowCount > 5) {
      const filledCols = [];
      for (let c = 0; c < 9; c++) {
        if (layout[row][c] && colCounts[c] > 1) filledCols.push(c);
      }
      if (filledCols.length === 0) return null;
      const rc = filledCols[Math.floor(Math.random() * filledCols.length)];
      layout[row][rc] = false; colCounts[rc]--; rowCount--;
    }
    while (rowCount < 5) {
      const emptyCols = [];
      for (let c = 0; c < 9; c++) {
        if (!layout[row][c] && colCounts[c] < 3) emptyCols.push(c);
      }
      if (emptyCols.length === 0) return null;
      const ac = emptyCols[Math.floor(Math.random() * emptyCols.length)];
      layout[row][ac] = true; colCounts[ac]++; rowCount++;
    }
  }

  for (let c = 0; c < 9; c++) {
    const count = (layout[0][c] ? 1 : 0) + (layout[1][c] ? 1 : 0) + (layout[2][c] ? 1 : 0);
    if (count === 0) return null;
  }

  const ticket: TambolaTicket = Array.from({ length: 3 }, () => Array(9).fill(null));
  for (let col = 0; col < 9; col++) {
    const rowsWithNumber: number[] = [];
    for (let row = 0; row < 3; row++) {
      if (layout[row][col]) rowsWithNumber.push(row);
    }
    const available = shuffle(getColumnNumbers(col));
    const picked = available.slice(0, rowsWithNumber.length).sort((a, b) => a - b);
    rowsWithNumber.sort((a, b) => a - b);
    for (let i = 0; i < rowsWithNumber.length; i++) {
      ticket[rowsWithNumber[i]][col] = picked[i];
    }
  }
  return ticket;
}

/**
 * Validate that a single ticket follows Tambola rules.
 * Note: For sheet tickets, empty columns ARE allowed (numbers may be on other tickets).
 */
export function validateTicket(ticket: TambolaTicket, allowEmptyColumns = false): { valid: boolean; errors: string[] } {
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

  const allNumbers = ticket.flat().filter((n): n is number => n !== null);
  if (allNumbers.length !== 15) {
    errors.push(`Expected 15 total numbers, got ${allNumbers.length}`);
  }

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

    if (!allowEmptyColumns && colNums.length === 0) {
      errors.push(`Col ${col}: must have at least 1 number`);
    }

    for (let i = 1; i < colNums.length; i++) {
      if (colNums[i] <= colNums[i - 1]) {
        errors.push(`Col ${col}: numbers not in ascending order`);
      }
    }
  }

  const unique = new Set(allNumbers);
  if (unique.size !== allNumbers.length) {
    errors.push('Duplicate numbers found');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a full sheet: 6 tickets, all 90 numbers exactly once.
 */
export function validateFullSheet(tickets: TambolaTicket[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tickets.length !== 6) {
    errors.push(`Expected 6 tickets, got ${tickets.length}`);
  }

  // Validate each ticket individually (allow empty columns for sheet tickets)
  tickets.forEach((ticket, i) => {
    const result = validateTicket(ticket, true);
    if (!result.valid) {
      errors.push(`Ticket ${i + 1}: ${result.errors.join(', ')}`);
    }
  });

  // Check all 90 numbers present exactly once
  const allNums = tickets.flatMap((t) => t.flat().filter((n): n is number => n !== null));
  if (allNums.length !== 90) {
    errors.push(`Expected 90 total numbers across sheet, got ${allNums.length}`);
  }

  const numSet = new Set(allNums);
  if (numSet.size !== 90) {
    errors.push(`Expected 90 unique numbers, got ${numSet.size} unique`);
  }

  for (let n = 1; n <= 90; n++) {
    if (!numSet.has(n)) {
      errors.push(`Number ${n} missing from sheet`);
    }
  }

  return { valid: errors.length === 0, errors };
}
