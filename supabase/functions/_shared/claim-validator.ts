export type TambolaTicket = (number | null)[][];

function getRowNumbers(ticket: TambolaTicket, row: number): number[] {
  return ticket[row].filter((n): n is number => n !== null);
}

function getCornerNumbers(ticket: TambolaTicket): number[] {
  const corners: number[] = [];
  const topNums = ticket[0].filter((n): n is number => n !== null);
  if (topNums.length >= 2) corners.push(topNums[0], topNums[topNums.length - 1]);
  const bottomNums = ticket[2].filter((n): n is number => n !== null);
  if (bottomNums.length >= 2) corners.push(bottomNums[0], bottomNums[bottomNums.length - 1]);
  return corners;
}

function getAllNumbers(ticket: TambolaTicket): number[] {
  return ticket.flat().filter((n): n is number => n !== null);
}

function allCalled(numbers: number[], calledNumbers: Set<number>): boolean {
  return numbers.every((n) => calledNumbers.has(n));
}

export const PATTERNS = {
  'Early Five': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      let count = 0;
      for (const n of getAllNumbers(ticket)) {
        if (called.has(n)) count++;
        if (count >= 5) return true;
      }
      return false;
    },
  },
  'Top Line': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => allCalled(getRowNumbers(ticket, 0), called),
  },
  'Middle Line': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => allCalled(getRowNumbers(ticket, 1), called),
  },
  'Bottom Line': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => allCalled(getRowNumbers(ticket, 2), called),
  },
  'Four Corners': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => allCalled(getCornerNumbers(ticket), called),
  },
  'Full House': {
    check: (ticket: TambolaTicket, called: Set<number>): boolean => allCalled(getAllNumbers(ticket), called),
  },
} as const;

export type PatternName = keyof typeof PATTERNS;

export function validateClaim(
  ticket: TambolaTicket,
  calledNumbers: number[],
  patternName: PatternName
): boolean {
  const pattern = PATTERNS[patternName];
  if (!pattern) return false;
  return pattern.check(ticket, new Set(calledNumbers));
}
