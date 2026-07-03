/**
 * Tambola Claim Validator
 *
 * Validates player claims against their ticket and called numbers.
 * Supports all standard patterns + extensibility for custom patterns.
 */

import type { TambolaTicket } from './ticket-generator';

export interface ClaimResult {
  valid: boolean;
  pattern: string;
  message: string;
}

/** Get all numbers in a specific row of a ticket */
function getRowNumbers(ticket: TambolaTicket, row: number): number[] {
  return ticket[row].filter((n): n is number => n !== null);
}

/** Get corner numbers of the ticket */
function getCornerNumbers(ticket: TambolaTicket): number[] {
  const corners: number[] = [];

  // Top row: first and last non-null
  const topNums = ticket[0].filter((n): n is number => n !== null);
  if (topNums.length >= 2) {
    corners.push(topNums[0], topNums[topNums.length - 1]);
  }

  // Bottom row: first and last non-null
  const bottomNums = ticket[2].filter((n): n is number => n !== null);
  if (bottomNums.length >= 2) {
    corners.push(bottomNums[0], bottomNums[bottomNums.length - 1]);
  }

  return corners;
}

/** Get all 15 numbers from the ticket */
function getAllNumbers(ticket: TambolaTicket): number[] {
  return ticket.flat().filter((n): n is number => n !== null);
}

/** Check if all numbers in a set have been called */
function allCalled(numbers: number[], calledNumbers: Set<number>): boolean {
  return numbers.every((n) => calledNumbers.has(n));
}

/**
 * Pattern definitions.
 * Each pattern defines which numbers on the ticket must be marked.
 */
export const PATTERNS = {
  'Early Five': {
    description: 'Any 5 numbers on the ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      const ticketNums = getAllNumbers(ticket);
      let count = 0;
      for (const n of ticketNums) {
        if (called.has(n)) count++;
        if (count >= 5) return true;
      }
      return false;
    },
  },
  'Top Line': {
    description: 'All 5 numbers in the top row',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 0), called);
    },
  },
  'Middle Line': {
    description: 'All 5 numbers in the middle row',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 1), called);
    },
  },
  'Bottom Line': {
    description: 'All 5 numbers in the bottom row',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 2), called);
    },
  },
  'Four Corners': {
    description: 'First & last numbers of top and bottom rows',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getCornerNumbers(ticket), called);
    },
  },
  'Full House': {
    description: 'All 15 numbers on the ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getAllNumbers(ticket), called);
    },
  },
} as const;

export type PatternName = keyof typeof PATTERNS;

export const ALL_PATTERN_NAMES: PatternName[] = Object.keys(PATTERNS) as PatternName[];

/**
 * Validate a player's claim.
 *
 * @param ticket - The player's ticket (3×9 grid)
 * @param calledNumbers - Array of all numbers called so far
 * @param patternName - The pattern being claimed
 * @returns ClaimResult indicating whether the claim is valid
 */
export function validateClaim(
  ticket: TambolaTicket,
  calledNumbers: number[],
  patternName: PatternName
): ClaimResult {
  const pattern = PATTERNS[patternName];
  if (!pattern) {
    return {
      valid: false,
      pattern: patternName,
      message: `Unknown pattern: ${patternName}`,
    };
  }

  const calledSet = new Set(calledNumbers);
  const isValid = pattern.check(ticket, calledSet);

  return {
    valid: isValid,
    pattern: patternName,
    message: isValid
      ? `🎉 Valid claim for ${patternName}!`
      : `❌ Bogey! Invalid claim for ${patternName}.`,
  };
}

/**
 * Get the progress of a ticket toward each pattern.
 * Returns the number of matching numbers / total needed for each pattern.
 */
export function getPatternProgress(
  ticket: TambolaTicket,
  calledNumbers: number[]
): Record<PatternName, { matched: number; total: number; complete: boolean }> {
  const called = new Set(calledNumbers);

  const countMatched = (nums: number[]): number =>
    nums.filter((n) => called.has(n)).length;

  const topRow = getRowNumbers(ticket, 0);
  const midRow = getRowNumbers(ticket, 1);
  const botRow = getRowNumbers(ticket, 2);
  const corners = getCornerNumbers(ticket);
  const all = getAllNumbers(ticket);

  // For Early Five, count how many of the 15 ticket numbers are called
  const earlyFiveMatched = Math.min(countMatched(all), 5);

  return {
    'Early Five': { matched: earlyFiveMatched, total: 5, complete: earlyFiveMatched >= 5 },
    'Top Line': { matched: countMatched(topRow), total: 5, complete: allCalled(topRow, called) },
    'Middle Line': { matched: countMatched(midRow), total: 5, complete: allCalled(midRow, called) },
    'Bottom Line': { matched: countMatched(botRow), total: 5, complete: allCalled(botRow, called) },
    'Four Corners': { matched: countMatched(corners), total: 4, complete: allCalled(corners, called) },
    'Full House': { matched: countMatched(all), total: 15, complete: allCalled(all, called) },
  };
}
