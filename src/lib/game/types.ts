/**
 * Tambola House — Data Types
 */

import type { TambolaTicket, TambolaSheet, SheetType } from './ticket-generator';
import type { PatternName } from './claim-validator';

export type GameStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

export interface Game {
  id: string;
  game_number: number;         // 1–20
  date: string;                // YYYY-MM-DD
  status: GameStatus;
  called_numbers: number[];
  number_sequence: number[];   // pre-shuffled 1-90 (admin-only)
  created_at: string;
}

export interface Ticket {
  id: string;
  game_id: string;
  player_name: string;
  player_phone: string;
  sheet_type: SheetType;       // 'full' or 'half'
  ticket_data: TambolaSheet;   // the actual ticket grids
  access_token: string;        // UUID — used in the player URL
  created_at: string;
}

export interface Claim {
  id: string;
  ticket_id: string;
  game_id: string;
  pattern: PatternName;
  ticket_index: number;        // which ticket in the sheet
  is_valid: boolean;
  player_name: string;
  validated_at: string;
}

/** Game with its tickets and claims */
export interface GameDetail extends Game {
  tickets: Ticket[];
  claims: Claim[];
}
