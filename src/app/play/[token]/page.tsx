'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { use } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import type { TambolaTicket, TambolaSheet } from '@/lib/game/ticket-generator';

interface TicketInfo {
  id: string;
  game_id: string;
  player_name: string;
  sheet_type: string;
  ticket_data: TambolaSheet;
  ticket_number: number | null;
  access_token: string;
}

interface GameInfo {
  id: string;
  game_number: number;
  status: string;
  called_numbers: number[];
}

const PATTERNS = [
  'Early Five',
  'Top Line',
  'Middle Line',
  'Bottom Line',
  'Four Corners',
  'Full House',
] as const;

export default function PlayerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set());
  const [claimStatus, setClaimStatus] = useState<Record<string, { status: string; message: string }>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const prevNumberRef = useRef<number | null>(null);

  // Ticket Selection State
  const [showSelector, setShowSelector] = useState(false);
  const [takenNumbers, setTakenNumbers] = useState<number[]>([]);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);

  // Fetch ticket + game data + taken booklet numbers
  const fetchData = useCallback(async () => {
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('access_token', token)
        .single();

      if (ticketError || !ticketData) {
        setError('Ticket not found. Please check your link.');
        return;
      }
      setTicket(ticketData);

      // If ticket_number is not yet chosen, show selection screen by default
      if (ticketData.ticket_number === null || ticketData.ticket_number === undefined) {
        setShowSelector(true);
      } else {
        setSelectedNum(ticketData.ticket_number);
      }

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('id, game_number, status, called_numbers')
        .eq('id', ticketData.game_id)
        .single();

      if (gameError || !gameData) {
        setError('Game not found.');
        return;
      }
      setGame(gameData);
      setCalledNumbers(gameData.called_numbers || []);

      // Fetch taken booklet numbers for this game
      const { data: allTickets } = await supabase
        .from('tickets')
        .select('id, ticket_number')
        .eq('game_id', ticketData.game_id)
        .not('ticket_number', 'is', null);

      const taken = allTickets
        ?.filter((t) => t.id !== ticketData.id && typeof t.ticket_number === 'number')
        .map((t) => t.ticket_number!) || [];
      setTakenNumbers(taken);
    } catch {
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Subscribe to Realtime for number calls
  useEffect(() => {
    if (!ticket?.game_id) return;

    const channel = supabase
      .channel(`game:${ticket.game_id}`)
      .on('broadcast', { event: 'number_called' }, (payload) => {
        const num = payload.payload?.number;
        const allCalled = payload.payload?.calledNumbers;
        if (typeof num === 'number') {
          setCalledNumbers(allCalled || ((prev: number[]) => [...prev, num]));
        }
      })
      .on('broadcast', { event: 'claim_result' }, (payload) => {
        const p = payload.payload;
        if (p) {
          showToast(`${p.playerName}: ${p.pattern} — ${p.isValid ? '✓ Valid' : '✗ Invalid'}`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticket?.game_id]);

  // Voice synthesis
  useEffect(() => {
    if (!voiceEnabled || calledNumbers.length === 0) return;
    const lastNum = calledNumbers[calledNumbers.length - 1];
    if (lastNum === prevNumberRef.current) return;
    prevNumberRef.current = lastNum;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const timer = setTimeout(() => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(lastNum.toString());
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [calledNumbers, voiceEnabled]);

  // Poll game status periodically
  useEffect(() => {
    if (!ticket?.game_id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('games')
        .select('status, called_numbers')
        .eq('id', ticket.game_id)
        .single();
      if (data) {
        setGame((prev) => prev ? { ...prev, status: data.status } : prev);
        setCalledNumbers(data.called_numbers || []);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [ticket?.game_id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const toggleMark = (num: number) => {
    setMarkedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const handleSelectBooklet = async () => {
    if (selectedNum === null || selecting) return;
    setSelecting(true);
    try {
      const res = await fetch('/api/tickets/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          ticketNumber: selectedNum,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ticket) {
        setTicket(data.ticket);
        setShowSelector(false);
        showToast(data.message);
      } else {
        showToast(data.error || 'Failed to lock ticket number');
      }
    } catch {
      showToast('Network error while selecting ticket');
    } finally {
      setSelecting(false);
    }
  };

  const submitClaim = async (pattern: string) => {
    if (!ticket) return;
    setClaimStatus((prev) => ({ ...prev, [pattern]: { status: 'loading', message: '' } }));

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          pattern,
        }),
      });
      const data = await res.json();
      setClaimStatus((prev) => ({
        ...prev,
        [pattern]: { status: data.valid ? 'valid' : 'invalid', message: data.message },
      }));
      showToast(data.message);
    } catch {
      setClaimStatus((prev) => ({
        ...prev,
        [pattern]: { status: 'error', message: 'Network error' },
      }));
    }
  };

  if (loading) {
    return <div className={styles.loadingPage}><span className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className={styles.loadingPage}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!ticket || !game) return null;

  const sheet = ticket.ticket_data;
  const tickets: TambolaTicket[] = sheet.tickets;
  const calledSet = new Set(calledNumbers);
  const lastCalled = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.playerName}>{ticket.player_name}</span>
          <span className={styles.gameMeta}>
            Game #{game.game_number} · Booklet #{ticket.ticket_number ?? '—'}
          </span>
        </div>
        <div className={styles.headerRight}>
          {game.status === 'UPCOMING' && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setSelectedNum(ticket.ticket_number || null);
                setShowSelector(true);
              }}
              title="Select different ticket number"
            >
              🎟️ Change #
            </button>
          )}
          <button
            className={styles.voiceBtn}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? 'Mute' : 'Unmute'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          <span className={`badge badge-${game.status.toLowerCase()}`}>{game.status}</span>
        </div>
      </header>

      {/* Ticket Booklet Selection Modal / View */}
      {showSelector && (
        <div className={styles.selectorModal}>
          <div className={styles.selectorCard}>
            <h2 className={styles.selectorTitle}>CHOOSE YOUR LUCKY BOOKLET</h2>
            <p className={styles.selectorSubtitle}>
              Select an available booklet number (1–50) for Game #{game.game_number}:
            </p>

            <div className={styles.numberGrid}>
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
                const isTaken = takenNumbers.includes(n);
                const isSelected = selectedNum === n;
                return (
                  <button
                    key={n}
                    className={`${styles.numBtn} ${isSelected ? styles.numBtnSelected : ''} ${isTaken ? styles.numBtnTaken : ''}`}
                    onClick={() => !isTaken && setSelectedNum(n)}
                    disabled={isTaken}
                  >
                    {isTaken ? `#{n} TAKEN` : `#${n}`}
                  </button>
                );
              })}
            </div>

            <div className={styles.selectorActions}>
              {selectedNum ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSelectBooklet}
                  disabled={selecting}
                  style={{ flex: 1 }}
                >
                  {selecting ? <span className="spinner" /> : `Lock In Booklet #${selectedNum}`}
                </button>
              ) : (
                <button className="btn btn-lg" disabled style={{ flex: 1, opacity: 0.5 }}>
                  Select a Number Above
                </button>
              )}

              {ticket.ticket_number !== null && (
                <button
                  className="btn"
                  onClick={() => setShowSelector(false)}
                  disabled={selecting}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Number Banner (Sticky at top under header) */}
      {game.status === 'LIVE' && lastCalled && (
        <div className={styles.currentBanner}>
          <span className={styles.currentLabel}>CALLED</span>
          <span className={styles.currentNum}>{lastCalled}</span>
          <span className={styles.calledCount}>{calledNumbers.length}/90</span>
        </div>
      )}

      {/* Waiting State */}
      {game.status === 'UPCOMING' && !showSelector && (
        <div className={styles.waitingBanner}>
          <p>Your Booklet #{ticket.ticket_number} is locked & ready! Game will start soon.</p>
        </div>
      )}

      {/* Completed State */}
      {game.status === 'COMPLETED' && (
        <div className={styles.waitingBanner}>
          <p>Game has ended. Thanks for playing!</p>
        </div>
      )}

      {/* Vertical Scrollable Tickets List */}
      <div className={styles.ticketsList}>
        {tickets.map((t, tIndex) => {
          const tNums = t.flat().filter((n): n is number => n !== null);
          const calledOnT = tNums.filter((n) => calledSet.has(n)).length;
          const bookNum = ticket.ticket_number ?? 1;
          const ticketSerial = `${bookNum}0${tIndex + 1}`;

          return (
            <div key={tIndex} className={styles.ticketCard}>
              <div className={styles.ticketHeader}>
                <span className={styles.ticketTitle}>TICKET #{ticketSerial}</span>
                <span className={styles.ticketProgress}>
                  {calledOnT}/{tNums.length} called
                </span>
              </div>
              <div className={styles.ticketGrid}>
                {t.map((row, ri) => (
                  <div key={ri} className={styles.ticketRow}>
                    {row.map((cell, ci) => {
                      if (cell === null) {
                        return <div key={ci} className={styles.ticketCellEmpty} />;
                      }
                      const isCalled = calledSet.has(cell);
                      const isMarked = markedNumbers.has(cell);
                      return (
                        <button
                          key={ci}
                          className={`${styles.ticketCell} ${isCalled ? styles.ticketCellCalled : ''} ${isMarked ? styles.ticketCellMarked : ''}`}
                          onClick={() => toggleMark(cell)}
                          disabled={game.status !== 'LIVE'}
                        >
                          {cell}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Claim Buttons Bar at Bottom */}
      {game.status === 'LIVE' && (
        <div className={styles.claims}>
          <span className={styles.claimsLabel}>CLAIM A PATTERN</span>
          <div className={styles.claimGrid}>
            {PATTERNS.map((p) => {
              const cs = claimStatus[p];
              return (
                <button
                  key={p}
                  className={`${styles.claimBtn} ${cs?.status === 'valid' ? styles.claimWon : ''} ${cs?.status === 'invalid' ? styles.claimFailed : ''}`}
                  onClick={() => submitClaim(p)}
                  disabled={cs?.status === 'loading' || cs?.status === 'valid'}
                >
                  {cs?.status === 'loading' ? <span className="spinner" /> : p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
