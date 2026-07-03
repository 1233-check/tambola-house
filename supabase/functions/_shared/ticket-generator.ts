export type TambolaTicket = (number | null)[][];

const COLUMN_RANGES: [number, number][] = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 90],
];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getColumnNumbers(colIndex: number): number[] {
  const [min, max] = COLUMN_RANGES[colIndex];
  const nums: number[] = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return nums;
}

export function generateTicket(): TambolaTicket {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = tryGenerateTicket();
    if (result) return result;
  }
  throw new Error('Failed to generate a valid ticket after 100 attempts');
}

function tryGenerateTicket(): TambolaTicket | null {
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
      if (colCounts[c] < 3) {
        colCounts[c]++;
        remaining--;
      }
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
      const removeCol = filledCols[Math.floor(Math.random() * filledCols.length)];
      layout[row][removeCol] = false;
      colCounts[removeCol]--;
      rowCount--;
    }
    while (rowCount < 5) {
      const emptyCols = [];
      for (let c = 0; c < 9; c++) {
        if (!layout[row][c] && colCounts[c] < 3) emptyCols.push(c);
      }
      if (emptyCols.length === 0) return null;
      const addCol = emptyCols[Math.floor(Math.random() * emptyCols.length)];
      layout[row][addCol] = true;
      colCounts[addCol]++;
      rowCount++;
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
