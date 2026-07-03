import { describe, it, expect } from 'vitest';
import {
  validateClaim,
  validateSheetClaim,
  getPatternProgress,
  getSheetPatternProgress,
  ALL_PATTERN_NAMES,
} from '@/lib/game/claim-validator';
import { generateFullSheet } from '@/lib/game/ticket-generator';
import type { TambolaTicket, TambolaSheet } from '@/lib/game/ticket-generator';

// Fixed test ticket (valid standalone)
const TICKET: TambolaTicket = [
  [null,  12, null,  34, null,  55,  62,  71, null],  // 12, 34, 55, 62, 71
  [   3, null,  25, null,  44, null, null,  78,  85], // 3, 25, 44, 78, 85
  [null,  18,  28, null,  49, null,  67, null,  90],  // 18, 28, 49, 67, 90
];

const ALL_TICKET_NUMBERS = [3, 12, 18, 25, 28, 34, 44, 49, 55, 62, 67, 71, 78, 85, 90];

describe('Single Ticket Claim Validator', () => {
  describe('Early Five', () => {
    it('should be valid when 5 ticket numbers are called', () => {
      const called = [3, 12, 25, 34, 44];
      const result = validateClaim(TICKET, called, 'Early Five');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when less than 5 ticket numbers are called', () => {
      const called = [3, 12, 25, 34];
      const result = validateClaim(TICKET, called, 'Early Five');
      expect(result.valid).toBe(false);
    });
  });

  describe('Top Line', () => {
    it('should be valid when all top row numbers are called', () => {
      const result = validateClaim(TICKET, [12, 34, 55, 62, 71], 'Top Line');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when top row is incomplete', () => {
      const result = validateClaim(TICKET, [12, 34, 55, 62], 'Top Line');
      expect(result.valid).toBe(false);
    });
  });

  describe('Middle Line', () => {
    it('should be valid when all middle row numbers are called', () => {
      const result = validateClaim(TICKET, [3, 25, 44, 78, 85], 'Middle Line');
      expect(result.valid).toBe(true);
    });
  });

  describe('Bottom Line', () => {
    it('should be valid when all bottom row numbers are called', () => {
      const result = validateClaim(TICKET, [18, 28, 49, 67, 90], 'Bottom Line');
      expect(result.valid).toBe(true);
    });
  });

  describe('Four Corners', () => {
    it('should be valid when all corners are called', () => {
      // Top: first=12, last=71; Bottom: first=18, last=90
      const result = validateClaim(TICKET, [12, 71, 18, 90], 'Four Corners');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when a corner is missing', () => {
      const result = validateClaim(TICKET, [12, 71, 18], 'Four Corners');
      expect(result.valid).toBe(false);
    });
  });

  describe('Full House', () => {
    it('should be valid when all 15 numbers are called', () => {
      const result = validateClaim(TICKET, ALL_TICKET_NUMBERS, 'Full House');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when any number is missing', () => {
      const result = validateClaim(TICKET, ALL_TICKET_NUMBERS.slice(0, 14), 'Full House');
      expect(result.valid).toBe(false);
    });
  });

  describe('getPatternProgress', () => {
    it('should return correct progress for each pattern', () => {
      const called = [12, 34, 55, 62];
      const progress = getPatternProgress(TICKET, called);

      expect(progress['Top Line'].matched).toBe(4);
      expect(progress['Top Line'].total).toBe(5);
      expect(progress['Top Line'].complete).toBe(false);
    });

    it('should mark pattern as complete when all numbers are called', () => {
      const progress = getPatternProgress(TICKET, [12, 34, 55, 62, 71]);
      expect(progress['Top Line'].complete).toBe(true);
    });
  });
});

describe('Sheet Claim Validator', () => {
  it('should find a valid claim across multiple tickets in a sheet', () => {
    const sheet = generateFullSheet();

    // Call ALL 90 numbers — Full House should be valid on every ticket
    const allCalled = Array.from({ length: 90 }, (_, i) => i + 1);
    const result = validateSheetClaim(sheet, allCalled, 'Full House');
    expect(result.valid).toBe(true);
    expect(result.ticketIndex).toBeGreaterThanOrEqual(0);
  });

  it('should return invalid when no ticket satisfies the pattern', () => {
    const sheet = generateFullSheet();
    // Call no numbers
    const result = validateSheetClaim(sheet, [], 'Full House');
    expect(result.valid).toBe(false);
    expect(result.ticketIndex).toBe(-1);
  });

  it('should validate against a specific ticket index', () => {
    const sheet = generateFullSheet();
    const ticket0Nums = sheet.tickets[0].flat().filter((n): n is number => n !== null);

    // Call all numbers on ticket 0
    const result = validateSheetClaim(sheet, ticket0Nums, 'Full House', 0);
    expect(result.valid).toBe(true);
    expect(result.ticketIndex).toBe(0);
  });

  it('should fail when specific ticket does not satisfy pattern', () => {
    const sheet = generateFullSheet();
    // Ticket 1 numbers only, but claim against ticket 0
    const ticket1Nums = sheet.tickets[1].flat().filter((n): n is number => n !== null);
    const result = validateSheetClaim(sheet, ticket1Nums, 'Full House', 0);
    expect(result.valid).toBe(false);
  });

  describe('getSheetPatternProgress', () => {
    it('should return the best progress across all tickets', () => {
      const sheet = generateFullSheet();
      // Call first ticket's top row numbers
      const topRowNums = sheet.tickets[0][0].filter((n): n is number => n !== null);
      const progress = getSheetPatternProgress(sheet, topRowNums);

      // Top Line should be complete for ticket 0
      expect(progress['Top Line'].complete).toBe(true);
      expect(progress['Top Line'].ticketIndex).toBe(0);
    });

    it('should track ticket index with most progress', () => {
      const sheet = generateFullSheet();
      // Don't call any numbers
      const progress = getSheetPatternProgress(sheet, []);
      
      // Nothing should be complete
      for (const p of ALL_PATTERN_NAMES) {
        expect(progress[p].complete).toBe(false);
      }
    });
  });
});
