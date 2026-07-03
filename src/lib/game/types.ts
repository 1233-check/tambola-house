/**
 * Game types shared across frontend and backend.
 */

import type { TambolaTicket } from './ticket-generator';
import type { PatternName } from './claim-validator';

export type GameStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED';

export interface GameSettings {
  autoCall: boolean;
  callIntervalMs: number; // 3000 – 10000
  patterns: PatternName[];
}

export interface Player {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isOnline: boolean;
}

export interface PlayerTicket {
  ticket: TambolaTicket;
  markedNumbers: number[];
}

export interface ClaimEvent {
  playerId: string;
  playerName: string;
  patternName: PatternName;
  isValid: boolean;
  timestamp: string;
}

export interface GameState {
  roomCode: string;
  gameId: string;
  status: GameStatus;
  hostId: string;
  calledNumbers: number[];
  currentNumber: number | null;
  players: Player[];
  claimedPatterns: Record<string, { winnerId: string; winnerName: string }>;
  settings: GameSettings;
}

/** Default game settings */
export const DEFAULT_SETTINGS: GameSettings = {
  autoCall: false,
  callIntervalMs: 5000,
  patterns: ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Four Corners', 'Full House'],
};
