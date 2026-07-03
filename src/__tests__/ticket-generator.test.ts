import { describe, it, expect } from 'vitest';
import {
  generateTicket,
  generateFullSheet,
  generateHalfSheet,
  generateSheet,
  validateTicket,
  validateFullSheet,
} from '@/lib/game/ticket-generator';

describe('Single Ticket Generator (legacy)', () => {
  it('should generate a valid 3×9 grid', () => {
    const ticket = generateTicket();
    expect(ticket).toHaveLength(3);
    ticket.forEach((row) => expect(row).toHaveLength(9));
  });

  it('should have exactly 5 numbers per row', () => {
    const ticket = generateTicket();
    ticket.forEach((row) => {
      const nums = row.filter((n) => n !== null);
      expect(nums).toHaveLength(5);
    });
  });

  it('should have exactly 15 numbers total', () => {
    const ticket = generateTicket();
    const all = ticket.flat().filter((n) => n !== null);
    expect(all).toHaveLength(15);
  });

  it('should have numbers in correct column ranges', () => {
    const ranges: [number, number][] = [
      [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
      [50, 59], [60, 69], [70, 79], [80, 90],
    ];
    const ticket = generateTicket();
    for (let col = 0; col < 9; col++) {
      const [min, max] = ranges[col];
      for (let row = 0; row < 3; row++) {
        const val = ticket[row][col];
        if (val !== null) {
          expect(val).toBeGreaterThanOrEqual(min);
          expect(val).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('should have numbers sorted ascending within each column', () => {
    const ticket = generateTicket();
    for (let col = 0; col < 9; col++) {
      const colNums = [ticket[0][col], ticket[1][col], ticket[2][col]].filter(
        (n): n is number => n !== null
      );
      for (let i = 1; i < colNums.length; i++) {
        expect(colNums[i]).toBeGreaterThan(colNums[i - 1]);
      }
    }
  });

  it('should have no duplicate numbers', () => {
    const ticket = generateTicket();
    const all = ticket.flat().filter((n): n is number => n !== null);
    expect(new Set(all).size).toBe(all.length);
  });

  it('should pass full validation', () => {
    for (let i = 0; i < 20; i++) {
      const ticket = generateTicket();
      const result = validateTicket(ticket);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

describe('Full Sheet Generator', () => {
  it('should generate a sheet with 6 tickets', () => {
    const sheet = generateFullSheet();
    expect(sheet.type).toBe('full');
    expect(sheet.tickets).toHaveLength(6);
  });

  it('should contain ALL 90 numbers exactly once across 6 tickets', () => {
    const sheet = generateFullSheet();
    const allNums = sheet.tickets.flatMap((t) =>
      t.flat().filter((n): n is number => n !== null)
    );
    expect(allNums).toHaveLength(90);
    expect(new Set(allNums).size).toBe(90);

    for (let n = 1; n <= 90; n++) {
      expect(allNums).toContain(n);
    }
  });

  it('should have each ticket with exactly 15 numbers', () => {
    const sheet = generateFullSheet();
    for (const ticket of sheet.tickets) {
      const nums = ticket.flat().filter((n) => n !== null);
      expect(nums).toHaveLength(15);
    }
  });

  it('should have 5 numbers per row on each ticket', () => {
    const sheet = generateFullSheet();
    for (const ticket of sheet.tickets) {
      for (const row of ticket) {
        const nums = row.filter((n) => n !== null);
        expect(nums).toHaveLength(5);
      }
    }
  });

  it('should have numbers in correct column ranges on each ticket', () => {
    const ranges: [number, number][] = [
      [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
      [50, 59], [60, 69], [70, 79], [80, 90],
    ];
    const sheet = generateFullSheet();
    for (const ticket of sheet.tickets) {
      for (let col = 0; col < 9; col++) {
        const [min, max] = ranges[col];
        for (let row = 0; row < 3; row++) {
          const val = ticket[row][col];
          if (val !== null) {
            expect(val).toBeGreaterThanOrEqual(min);
            expect(val).toBeLessThanOrEqual(max);
          }
        }
      }
    }
  });

  it('should have ascending column sort on each ticket', () => {
    const sheet = generateFullSheet();
    for (const ticket of sheet.tickets) {
      for (let col = 0; col < 9; col++) {
        const colNums = [ticket[0][col], ticket[1][col], ticket[2][col]].filter(
          (n): n is number => n !== null
        );
        for (let i = 1; i < colNums.length; i++) {
          expect(colNums[i]).toBeGreaterThan(colNums[i - 1]);
        }
      }
    }
  });

  it('should pass full sheet validation', () => {
    // Generate 5 full sheets and validate each
    for (let i = 0; i < 5; i++) {
      const sheet = generateFullSheet();
      const result = validateFullSheet(sheet.tickets);
      expect(result.valid).toBe(true);
      if (!result.valid) {
        console.error('Sheet validation failed:', result.errors);
      }
    }
  });
});

describe('Half Sheet Generator', () => {
  it('should generate a sheet with 3 tickets', () => {
    const sheet = generateHalfSheet();
    expect(sheet.type).toBe('half');
    expect(sheet.tickets).toHaveLength(3);
  });

  it('should have 45 numbers total (3 tickets × 15)', () => {
    const sheet = generateHalfSheet();
    const allNums = sheet.tickets.flatMap((t) =>
      t.flat().filter((n): n is number => n !== null)
    );
    expect(allNums).toHaveLength(45);
    expect(new Set(allNums).size).toBe(45); // no duplicates
  });

  it('should have each ticket with exactly 15 numbers and 5 per row', () => {
    const sheet = generateHalfSheet();
    for (const ticket of sheet.tickets) {
      const nums = ticket.flat().filter((n) => n !== null);
      expect(nums).toHaveLength(15);
      for (const row of ticket) {
        const rowNums = row.filter((n) => n !== null);
        expect(rowNums).toHaveLength(5);
      }
    }
  });
});

describe('generateSheet helper', () => {
  it('should generate a full sheet when type is "full"', () => {
    const sheet = generateSheet('full');
    expect(sheet.type).toBe('full');
    expect(sheet.tickets).toHaveLength(6);
  });

  it('should generate a half sheet when type is "half"', () => {
    const sheet = generateSheet('half');
    expect(sheet.type).toBe('half');
    expect(sheet.tickets).toHaveLength(3);
  });
});
