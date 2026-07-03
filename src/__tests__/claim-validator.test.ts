import { describe, it, expect } from 'vitest';
import { validateClaim, getPatternProgress, ALL_PATTERN_NAMES } from '@/lib/game/claim-validator';
import type { TambolaTicket } from '@/lib/game/ticket-generator';

/**
 * Fixed test ticket:
 *   Row 0: [ null,  12, null,  34, null, null,  62,  71, null ]
 *   Row 1: [    3, null,  25, null,  44,  55, null, null,  85 ]
 *   Row 2: [ null, null,  28, null,  49, null,  67,  79, null ]
 *
 * - Row 0 numbers: 12, 34, 62, 71    → only 4 (invalid ticket for testing, but let's make it 5)
 * Let me make a properly valid ticket:
 */
const TEST_TICKET: TambolaTicket = [
  [null,  12, null,  34, null,  55,  62,  71, null],  // row 0: 12, 34, 55, 62, 71
  [   3, null,  25, null,  44, null, null, null,  85], // row 1: 3, 25, 44, 85 → need 5... add one
  [null,  18,  28, null,  49, null,  67, null,  90],   // row 2: 18, 28, 49, 67, 90
];

// Actually let me fix row 1 to have exactly 5:
const TICKET: TambolaTicket = [
  [null,  12, null,  34, null,  55,  62,  71, null],  // 12, 34, 55, 62, 71
  [   3, null,  25, null,  44, null, null,  78,  85], // 3, 25, 44, 78, 85
  [null,  18,  28, null,  49, null,  67, null,  90],  // 18, 28, 49, 67, 90
];

// All 15 numbers: 3, 12, 18, 25, 28, 34, 44, 49, 55, 62, 67, 71, 78, 85, 90
const ALL_TICKET_NUMBERS = [3, 12, 18, 25, 28, 34, 44, 49, 55, 62, 67, 71, 78, 85, 90];

describe('Claim Validator', () => {
  describe('Early Five', () => {
    it('should be valid when 5 ticket numbers are called', () => {
      const called = [3, 12, 25, 34, 44]; // 5 numbers on the ticket
      const result = validateClaim(TICKET, called, 'Early Five');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when less than 5 ticket numbers are called', () => {
      const called = [3, 12, 25, 34]; // Only 4 ticket numbers
      const result = validateClaim(TICKET, called, 'Early Five');
      expect(result.valid).toBe(false);
    });

    it('should count only ticket numbers, not random ones', () => {
      const called = [1, 2, 5, 10, 20, 30, 40, 50]; // 0 ticket numbers
      const result = validateClaim(TICKET, called, 'Early Five');
      expect(result.valid).toBe(false);
    });
  });

  describe('Top Line', () => {
    it('should be valid when all top row numbers are called', () => {
      const called = [12, 34, 55, 62, 71]; // All row 0
      const result = validateClaim(TICKET, called, 'Top Line');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when top row is incomplete', () => {
      const called = [12, 34, 55, 62]; // Missing 71
      const result = validateClaim(TICKET, called, 'Top Line');
      expect(result.valid).toBe(false);
    });
  });

  describe('Middle Line', () => {
    it('should be valid when all middle row numbers are called', () => {
      const called = [3, 25, 44, 78, 85]; // All row 1
      const result = validateClaim(TICKET, called, 'Middle Line');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when middle row is incomplete', () => {
      const called = [3, 25, 44, 78]; // Missing 85
      const result = validateClaim(TICKET, called, 'Middle Line');
      expect(result.valid).toBe(false);
    });
  });

  describe('Bottom Line', () => {
    it('should be valid when all bottom row numbers are called', () => {
      const called = [18, 28, 49, 67, 90]; // All row 2
      const result = validateClaim(TICKET, called, 'Bottom Line');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when bottom row is incomplete', () => {
      const called = [18, 28, 49, 67]; // Missing 90
      const result = validateClaim(TICKET, called, 'Bottom Line');
      expect(result.valid).toBe(false);
    });
  });

  describe('Four Corners', () => {
    it('should be valid when all corners are called', () => {
      // Top row first num: 12, last num: 71
      // Bottom row first num: 18, last num: 90
      const called = [12, 71, 18, 90];
      const result = validateClaim(TICKET, called, 'Four Corners');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when a corner is missing', () => {
      const called = [12, 71, 18]; // Missing 90
      const result = validateClaim(TICKET, called, 'Four Corners');
      expect(result.valid).toBe(false);
    });
  });

  describe('Full House', () => {
    it('should be valid when all 15 numbers are called', () => {
      const result = validateClaim(TICKET, ALL_TICKET_NUMBERS, 'Full House');
      expect(result.valid).toBe(true);
    });

    it('should be invalid when any number is missing', () => {
      const called = ALL_TICKET_NUMBERS.slice(0, 14); // Missing last
      const result = validateClaim(TICKET, called, 'Full House');
      expect(result.valid).toBe(false);
    });
  });

  describe('getPatternProgress', () => {
    it('should return correct progress for each pattern', () => {
      const called = [12, 34, 55, 62]; // 4 of 5 top row numbers
      const progress = getPatternProgress(TICKET, called);

      expect(progress['Top Line'].matched).toBe(4);
      expect(progress['Top Line'].total).toBe(5);
      expect(progress['Top Line'].complete).toBe(false);

      expect(progress['Early Five'].matched).toBe(4);
      expect(progress['Early Five'].total).toBe(5);
    });

    it('should mark pattern as complete when all needed numbers are called', () => {
      const called = [12, 34, 55, 62, 71]; // All top row
      const progress = getPatternProgress(TICKET, called);
      expect(progress['Top Line'].complete).toBe(true);
    });
  });
});
