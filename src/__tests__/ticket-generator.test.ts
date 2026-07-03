import { describe, it, expect } from 'vitest';
import { generateTicket, generateTickets, validateTicket } from '@/lib/game/ticket-generator';

describe('Ticket Generator', () => {
  describe('generateTicket', () => {
    it('should generate a valid 3×9 grid', () => {
      const ticket = generateTicket();
      expect(ticket).toHaveLength(3);
      ticket.forEach((row) => {
        expect(row).toHaveLength(9);
      });
    });

    it('should have exactly 5 numbers per row', () => {
      const ticket = generateTicket();
      ticket.forEach((row, i) => {
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

    it('should have at least 1 number in every column', () => {
      const ticket = generateTicket();
      for (let col = 0; col < 9; col++) {
        const colNums = [ticket[0][col], ticket[1][col], ticket[2][col]].filter(
          (n) => n !== null
        );
        expect(colNums.length).toBeGreaterThanOrEqual(1);
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
      const unique = new Set(all);
      expect(unique.size).toBe(all.length);
    });

    it('should pass full validation', () => {
      // Generate 50 tickets and validate each
      for (let i = 0; i < 50; i++) {
        const ticket = generateTicket();
        const result = validateTicket(ticket);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe('generateTickets', () => {
    it('should generate the requested number of unique tickets', () => {
      const tickets = generateTickets(10);
      expect(tickets).toHaveLength(10);

      // Check uniqueness
      const keys = tickets.map((t) => JSON.stringify(t));
      const unique = new Set(keys);
      expect(unique.size).toBe(10);
    });

    it('should generate 25 valid tickets (max players)', () => {
      const tickets = generateTickets(25);
      expect(tickets).toHaveLength(25);
      tickets.forEach((ticket) => {
        const result = validateTicket(ticket);
        expect(result.valid).toBe(true);
      });
    });
  });
});
