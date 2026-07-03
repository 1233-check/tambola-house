'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameState, GameStatus, Player, ClaimEvent } from '@/lib/game/types';
import type { TambolaTicket } from '@/lib/game/ticket-generator';
import type { PatternName } from '@/lib/game/claim-validator';
import { getPatternProgress } from '@/lib/game/claim-validator';
import type { RealtimeChannel } from '@supabase/supabase-js';

/* ---- State ---- */
interface AppState {
  /* Auth */
  playerId: string | null;
  playerName: string;

  /* Room */
  roomCode: string | null;
  gameId: string | null;
  isHost: boolean;

  /* Game */
  status: GameStatus;
  players: Player[];
  ticket: TambolaTicket | null;
  calledNumbers: number[];
  currentNumber: number | null;
  markedNumbers: Set<number>;
  claimedPatterns: Record<string, { winnerId: string; winnerName: string }>;
  settings: GameState['settings'];

  /* Events feed */
  events: ClaimEvent[];

  /* UI */
  loading: boolean;
  error: string | null;
}

const initialState: AppState = {
  playerId: null,
  playerName: '',
  roomCode: null,
  gameId: null,
  isHost: false,
  status: 'LOBBY',
  players: [],
  ticket: null,
  calledNumbers: [],
  currentNumber: null,
  markedNumbers: new Set(),
  claimedPatterns: {},
  settings: {
    autoCall: false,
    callIntervalMs: 5000,
    patterns: ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Four Corners', 'Full House'],
  },
  events: [],
  loading: false,
  error: null,
};

/* ---- Actions ---- */
type Action =
  | { type: 'SET_PLAYER'; playerId: string; playerName: string }
  | { type: 'SET_ROOM'; roomCode: string; gameId: string; isHost: boolean }
  | { type: 'SET_STATUS'; status: GameStatus }
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'SET_TICKET'; ticket: TambolaTicket }
  | { type: 'NUMBER_CALLED'; number: number }
  | { type: 'MARK_NUMBER'; number: number }
  | { type: 'UNMARK_NUMBER'; number: number }
  | { type: 'CLAIM_RESULT'; event: ClaimEvent }
  | { type: 'SET_SETTINGS'; settings: Partial<GameState['settings']> }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' }
  | { type: 'GAME_STARTED'; calledNumbers: number[] }
  | { type: 'SYNC_STATE'; calledNumbers: number[]; claimedPatterns: Record<string, { winnerId: string; winnerName: string }>; status: GameStatus };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, playerName: action.playerName };
    case 'SET_ROOM':
      return { ...state, roomCode: action.roomCode, gameId: action.gameId, isHost: action.isHost };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'PLAYER_JOINED':
      if (state.players.some(p => p.id === action.player.id)) return state;
      return { ...state, players: [...state.players, action.player] };
    case 'PLAYER_LEFT':
      return { ...state, players: state.players.filter(p => p.id !== action.playerId) };
    case 'SET_TICKET':
      return { ...state, ticket: action.ticket };
    case 'NUMBER_CALLED':
      if (state.calledNumbers.includes(action.number)) return state;
      return {
        ...state,
        calledNumbers: [...state.calledNumbers, action.number],
        currentNumber: action.number,
      };
    case 'MARK_NUMBER':
      const newMarked = new Set(state.markedNumbers);
      newMarked.add(action.number);
      return { ...state, markedNumbers: newMarked };
    case 'UNMARK_NUMBER':
      const newUnmarked = new Set(state.markedNumbers);
      newUnmarked.delete(action.number);
      return { ...state, markedNumbers: newUnmarked };
    case 'CLAIM_RESULT':
      const newClaimed = { ...state.claimedPatterns };
      if (action.event.isValid) {
        newClaimed[action.event.patternName] = {
          winnerId: action.event.playerId,
          winnerName: action.event.playerName,
        };
      }
      return {
        ...state,
        claimedPatterns: newClaimed,
        events: [action.event, ...state.events].slice(0, 50),
      };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'GAME_STARTED':
      return { ...state, status: 'IN_PROGRESS', calledNumbers: action.calledNumbers || [] };
    case 'SYNC_STATE':
      return {
        ...state,
        calledNumbers: action.calledNumbers,
        claimedPatterns: action.claimedPatterns,
        status: action.status,
        currentNumber: action.calledNumbers.length > 0 ? action.calledNumbers[action.calledNumbers.length - 1] : null,
      };
    case 'RESET':
      return { ...initialState, playerId: state.playerId, playerName: state.playerName };
    default:
      return state;
  }
}

/* ---- Context ---- */
interface GameContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;

  /* Actions */
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<void>;
  startGame: () => Promise<void>;
  callNumber: () => Promise<number | null>;
  markNumber: (num: number) => void;
  submitClaim: (pattern: PatternName) => Promise<ClaimResult | null>;
  leaveRoom: () => void;

  /* Helpers */
  patternProgress: ReturnType<typeof getPatternProgress> | null;
}

interface ClaimResult {
  valid: boolean;
  pattern: string;
  message: string;
}

const GameContext = createContext<GameContextValue | null>(null);

/* ---- Provider ---- */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const autoCallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (autoCallTimerRef.current) {
        clearInterval(autoCallTimerRef.current);
      }
    };
  }, []);

  /* Subscribe to Realtime channel for a room */
  const subscribeToRoom = useCallback((roomCode: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`game:${roomCode}`);

    channel
      .on('broadcast', { event: 'number_called' }, (payload) => {
        const num = payload.payload?.number;
        if (typeof num === 'number') {
          dispatch({ type: 'NUMBER_CALLED', number: num });
        }
      })
      .on('broadcast', { event: 'game_started' }, () => {
        dispatch({ type: 'SET_STATUS', status: 'IN_PROGRESS' });
      })
      .on('broadcast', { event: 'game_ended' }, () => {
        dispatch({ type: 'SET_STATUS', status: 'COMPLETED' });
        if (autoCallTimerRef.current) {
          clearInterval(autoCallTimerRef.current);
          autoCallTimerRef.current = null;
        }
      })
      .on('broadcast', { event: 'claim_result' }, (payload) => {
        const ev = payload.payload as ClaimEvent;
        if (ev) {
          dispatch({ type: 'CLAIM_RESULT', event: ev });
        }
      })
      .on('broadcast', { event: 'player_joined' }, (payload) => {
        const player = payload.payload as Player;
        if (player) {
          dispatch({ type: 'PLAYER_JOINED', player });
        }
      })
      .on('broadcast', { event: 'player_left' }, (payload) => {
        const playerId = payload.payload?.playerId;
        if (playerId) {
          dispatch({ type: 'PLAYER_LEFT', playerId });
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const players: Player[] = [];
        for (const key in presenceState) {
          const entries = presenceState[key] as unknown as Array<{
            user_id: string;
            display_name: string;
            is_host: boolean;
          }>;
          for (const entry of entries) {
            players.push({
              id: entry.user_id,
              displayName: entry.display_name,
              isHost: entry.is_host,
              isOnline: true,
            });
          }
        }
        dispatch({ type: 'SET_PLAYERS', players });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: state.playerId,
            display_name: state.playerName,
            is_host: state.isHost,
          });
        }
      });

    channelRef.current = channel;
  }, [state.playerId, state.playerName, state.isHost]);

  /* --- Create Room --- */
  const createRoom = useCallback(async (playerName: string): Promise<string> => {
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      // Generate player ID (anonymous)
      const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'SET_PLAYER', playerId, playerName });

      // Generate room code
      const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const gameId = `game_${Date.now()}`;

      dispatch({ type: 'SET_ROOM', roomCode, gameId, isHost: true });

      // For MVP: store game state via Supabase
      // If Supabase is not configured, we still run the frontend in demo mode
      try {
        await supabase.from('games').insert({
          id: gameId,
          room_code: roomCode,
          host_id: playerId,
          status: 'LOBBY',
          called_numbers: [],
          number_sequence: shuffleRange(1, 90),
          max_players: 25,
        });
      } catch {
        // Supabase not configured — continue in local/demo mode
        console.warn('Supabase not configured, running in demo mode');
      }

      return roomCode;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  /* --- Join Room --- */
  const joinRoom = useCallback(async (roomCode: string, playerName: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'SET_PLAYER', playerId, playerName });

      const gameId = `game_joined_${roomCode}`;
      dispatch({ type: 'SET_ROOM', roomCode, gameId, isHost: false });

      // Generate ticket for this player
      const { generateTicket } = await import('@/lib/game/ticket-generator');
      const ticket = generateTicket();
      dispatch({ type: 'SET_TICKET', ticket });

      // Subscribe to room channel
      subscribeToRoom(roomCode);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [subscribeToRoom]);

  /* --- Start Game --- */
  const startGame = useCallback(async (): Promise<void> => {
    if (!state.isHost || !state.roomCode) return;

    dispatch({ type: 'SET_STATUS', status: 'IN_PROGRESS' });

    // Generate ticket for host too
    if (!state.ticket) {
      const { generateTicket } = await import('@/lib/game/ticket-generator');
      const ticket = generateTicket();
      dispatch({ type: 'SET_TICKET', ticket });
    }

    // Broadcast game started
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_started',
        payload: {},
      });
    }
  }, [state.isHost, state.roomCode, state.ticket]);

  /* --- Call Number --- */
  const callNumber = useCallback(async (): Promise<number | null> => {
    if (!state.isHost) return null;

    // Find next uncalled number
    const allNumbers = shuffleRange(1, 90);
    const calledSet = new Set(state.calledNumbers);
    const nextNumber = allNumbers.find(n => !calledSet.has(n));

    if (nextNumber === undefined) {
      dispatch({ type: 'SET_STATUS', status: 'COMPLETED' });
      return null;
    }

    dispatch({ type: 'NUMBER_CALLED', number: nextNumber });

    // Broadcast to all players
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'number_called',
        payload: { number: nextNumber },
      });
    }

    return nextNumber;
  }, [state.isHost, state.calledNumbers]);

  /* --- Mark Number --- */
  const markNumber = useCallback((num: number) => {
    if (state.markedNumbers.has(num)) {
      dispatch({ type: 'UNMARK_NUMBER', number: num });
    } else {
      dispatch({ type: 'MARK_NUMBER', number: num });
    }
  }, [state.markedNumbers]);

  /* --- Submit Claim --- */
  const submitClaim = useCallback(async (pattern: PatternName): Promise<ClaimResult | null> => {
    if (!state.ticket || !state.playerId) return null;

    const { validateClaim } = await import('@/lib/game/claim-validator');
    const result = validateClaim(state.ticket, state.calledNumbers, pattern);

    const event: ClaimEvent = {
      playerId: state.playerId,
      playerName: state.playerName,
      patternName: pattern,
      isValid: result.valid,
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: 'CLAIM_RESULT', event });

    // Broadcast claim result
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'claim_result',
        payload: event,
      });
    }

    return result;
  }, [state.ticket, state.calledNumbers, state.playerId, state.playerName]);

  /* --- Leave Room --- */
  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_left',
        payload: { playerId: state.playerId },
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (autoCallTimerRef.current) {
      clearInterval(autoCallTimerRef.current);
      autoCallTimerRef.current = null;
    }
    dispatch({ type: 'RESET' });
  }, [state.playerId]);

  /* Pattern progress */
  const patternProgress = state.ticket
    ? getPatternProgress(state.ticket, state.calledNumbers)
    : null;

  const value: GameContextValue = {
    state,
    dispatch,
    createRoom,
    joinRoom,
    startGame,
    callNumber,
    markNumber,
    submitClaim,
    leaveRoom,
    patternProgress,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}

/* Utility: generate a shuffled range of numbers */
function shuffleRange(min: number, max: number): number[] {
  const arr: number[] = [];
  for (let i = min; i <= max; i++) arr.push(i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
