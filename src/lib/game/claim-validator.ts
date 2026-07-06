/**
 * Tambola Claim Validator
 *
 * Validates player claims against their ticket(s) and called numbers.
 * Supports both single-ticket and sheet-based (multi-ticket) validation.
 * All standard patterns + extensibility for custom patterns.
 */

import type { TambolaTicket, TambolaSheet } from './ticket-generator';

export interface ClaimResult {
  valid: boolean;
  pattern: string;
  ticketIndex: number; // which ticket in the sheet satisfied the claim (-1 if invalid)
  message: string;
}

/** Get all numbers in a specific row of a ticket */
function getRowNumbers(ticket: TambolaTicket, row: number): number[] {
  return ticket[row].filter((n): n is number => n !== null);
}

/** Get corner numbers of the ticket */
function getCornerNumbers(ticket: TambolaTicket): number[] {
  const corners: number[] = [];
  const topNums = ticket[0].filter((n): n is number => n !== null);
  if (topNums.length >= 2) {
    corners.push(topNums[0], topNums[topNums.length - 1]);
  }
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
 * Each pattern defines which numbers on a single ticket must be marked.
 */
export const PATTERNS = {
  'Early Seven': {
    description: 'Any 7 numbers on a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      const ticketNums = getAllNumbers(ticket);
      let count = 0;
      for (const n of ticketNums) {
        if (called.has(n)) count++;
        if (count >= 7) return true;
      }
      return false;
    },
  },
  'Top Line': {
    description: 'All 5 numbers in the top row of a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 0), called);
    },
  },
  'Middle Line': {
    description: 'All 5 numbers in the middle row of a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 1), called);
    },
  },
  'Bottom Line': {
    description: 'All 5 numbers in the bottom row of a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getRowNumbers(ticket, 2), called);
    },
  },
  'Four Corners': {
    description: 'First & last numbers of top and bottom rows of a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getCornerNumbers(ticket), called);
    },
  },
  'Full House': {
    description: 'All 15 numbers on a single ticket',
    check: (ticket: TambolaTicket, called: Set<number>): boolean => {
      return allCalled(getAllNumbers(ticket), called);
    },
  },
} as const;

export type PatternName = keyof typeof PATTERNS;

export const ALL_PATTERN_NAMES: PatternName[] = Object.keys(PATTERNS) as PatternName[];

/**
 * Validate a player's claim against a SINGLE ticket.
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
      ticketIndex: -1,
      message: `Unknown pattern: ${patternName}`,
    };
  }

  const calledSet = new Set(calledNumbers);
  const isValid = pattern.check(ticket, calledSet);

  return {
    valid: isValid,
    pattern: patternName,
    ticketIndex: 0,
    message: isValid
      ? `🎉 Valid claim for ${patternName}!`
      : `❌ Bogey! Invalid claim for ${patternName}.`,
  };
}

/**
 * Validate a player's claim against their ENTIRE SHEET (multiple tickets).
 * A claim is valid if ANY ticket in the sheet satisfies the pattern.
 * Returns which ticket index satisfied it.
 */
export function validateSheetClaim(
  sheet: TambolaSheet,
  calledNumbers: number[],
  patternName: PatternName,
  specificTicketIndex?: number
): ClaimResult {
  const pattern = PATTERNS[patternName];
  if (!pattern) {
    return {
      valid: false,
      pattern: patternName,
      ticketIndex: -1,
      message: `Unknown pattern: ${patternName}`,
    };
  }

  const calledSet = new Set(calledNumbers);

  // If a specific ticket index is provided, only check that one
  if (specificTicketIndex !== undefined) {
    if (specificTicketIndex < 0 || specificTicketIndex >= sheet.tickets.length) {
      return {
        valid: false,
        pattern: patternName,
        ticketIndex: -1,
        message: `Invalid ticket index: ${specificTicketIndex}`,
      };
    }
    const isValid = pattern.check(sheet.tickets[specificTicketIndex], calledSet);
    return {
      valid: isValid,
      pattern: patternName,
      ticketIndex: specificTicketIndex,
      message: isValid
        ? `🎉 Valid claim for ${patternName} on Ticket ${specificTicketIndex + 1}!`
        : `❌ Bogey! Invalid claim for ${patternName} on Ticket ${specificTicketIndex + 1}.`,
    };
  }

  // Check all tickets — return the first one that satisfies the pattern
  for (let i = 0; i < sheet.tickets.length; i++) {
    if (pattern.check(sheet.tickets[i], calledSet)) {
      return {
        valid: true,
        pattern: patternName,
        ticketIndex: i,
        message: `🎉 Valid claim for ${patternName} on Ticket ${i + 1}!`,
      };
    }
  }

  return {
    valid: false,
    pattern: patternName,
    ticketIndex: -1,
    message: `❌ Bogey! Invalid claim for ${patternName}.`,
  };
}

/**
 * Get the progress of a SINGLE ticket toward each pattern.
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
  const earlySevenMatched = Math.min(countMatched(all), 7);

  return {
    'Early Seven': { matched: earlySevenMatched, total: 7, complete: earlySevenMatched >= 7 },
    'Top Line': { matched: countMatched(topRow), total: 5, complete: allCalled(topRow, called) },
    'Middle Line': { matched: countMatched(midRow), total: 5, complete: allCalled(midRow, called) },
    'Bottom Line': { matched: countMatched(botRow), total: 5, complete: allCalled(botRow, called) },
    'Four Corners': { matched: countMatched(corners), total: 4, complete: allCalled(corners, called) },
    'Full House': { matched: countMatched(all), total: 15, complete: allCalled(all, called) },
  };
}

/**
 * Get the BEST progress across all tickets in a sheet for each pattern.
 * Returns the ticket index with the best progress for each pattern.
 */
export function getSheetPatternProgress(
  sheet: TambolaSheet,
  calledNumbers: number[]
): Record<PatternName, { matched: number; total: number; complete: boolean; ticketIndex: number }> {
  const result: Record<string, { matched: number; total: number; complete: boolean; ticketIndex: number }> = {};

  for (const patternName of ALL_PATTERN_NAMES) {
    let bestMatched = 0;
    let bestTotal = 0;
    let bestComplete = false;
    let bestTicketIndex = 0;

    for (let i = 0; i < sheet.tickets.length; i++) {
      const progress = getPatternProgress(sheet.tickets[i], calledNumbers);
      const p = progress[patternName];

      if (p.complete) {
        bestMatched = p.matched;
        bestTotal = p.total;
        bestComplete = true;
        bestTicketIndex = i;
        break; // Found a complete one, no need to check further
      }

      // Track the one with the most progress
      if (p.matched > bestMatched || (p.matched === bestMatched && p.total < bestTotal)) {
        bestMatched = p.matched;
        bestTotal = p.total;
        bestTicketIndex = i;
      }
    }

    // If no ticket was processed, use defaults
    if (sheet.tickets.length > 0 && bestTotal === 0) {
      const firstProgress = getPatternProgress(sheet.tickets[0], calledNumbers);
      bestTotal = firstProgress[patternName].total;
    }

    result[patternName] = {
      matched: bestMatched,
      total: bestTotal,
      complete: bestComplete,
      ticketIndex: bestTicketIndex,
    };
  }

  return result as Record<PatternName, { matched: number; total: number; complete: boolean; ticketIndex: number }>;
}
