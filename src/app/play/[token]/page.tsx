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
  selected_tickets: number[] | null;
  access_token: string;
}

interface GameInfo {
  id: string;
  game_number: number;
  status: string;
  called_numbers: number[];
}

interface Winner {
  playerName: string;
  pattern: string;
}

export default function PlayerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const prevNumberRef = useRef<number | null>(null);

  // Winners list
  const [winners, setWinners] = useState<Winner[]>([]);

  // Ticket Selection State
  const [showSelector, setShowSelector] = useState(false);
  const [takenNumbers, setTakenNumbers] = useState<number[]>([]);
  const [hoveredStart, setHoveredStart] = useState<number | null>(null);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);

  // Fetch ticket + game data + existing winners
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

      const hasSelected = Array.isArray(ticketData.selected_tickets) && ticketData.selected_tickets.length > 0;
      if (!hasSelected) {
        setShowSelector(true);
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

      // Fetch existing winners (valid claims)
      const { data: claims } = await supabase
        .from('claims')
        .select('pattern, player_name')
        .eq('game_id', ticketData.game_id)
        .eq('is_valid', true);

      if (claims) {
        setWinners(claims.map((c) => ({ playerName: c.player_name, pattern: c.pattern })));
      }

      // Fetch taken ticket numbers
      const { data: allTickets } = await supabase
        .from('tickets')
        .select('id, selected_tickets')
        .eq('game_id', ticketData.game_id)
        .not('selected_tickets', 'is', null);

      const takenSet = new Set<number>();
      allTickets?.forEach((t) => {
        if (t.id !== ticketData.id && Array.isArray(t.selected_tickets)) {
          t.selected_tickets.forEach((n: number) => takenSet.add(n));
        }
      });
      setTakenNumbers(Array.from(takenSet));
    } catch {
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription
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
        if (p && p.isValid) {
          // Add to winners list (avoid duplicates)
          setWinners((prev) => {
            const exists = prev.some((w) => w.pattern === p.pattern);
            if (exists) return prev;
            return [...prev, { playerName: p.playerName, pattern: p.pattern }];
          });

          // Show celebration toast
          const isMe = ticket?.player_name === p.playerName;
          showToast(
            isMe
              ? `🎉 YOU WON ${p.pattern}!`
              : `🏆 ${p.playerName} won ${p.pattern}!`
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket?.game_id, ticket?.player_name]);

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

  // Poll game status + winners
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

      // Refresh winners
      const { data: claims } = await supabase
        .from('claims')
        .select('pattern, player_name')
        .eq('game_id', ticket.game_id)
        .eq('is_valid', true);
      if (claims) {
        setWinners(claims.map((c) => ({ playerName: c.player_name, pattern: c.pattern })));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [ticket?.game_id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  };

  const toggleMark = (num: number) => {
    setMarkedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  // Consecutive block logic
  const ticketCount = ticket?.sheet_type === 'half' ? 3 : 6;
  const maxStart = 66 - ticketCount + 1;
  const takenSet = new Set(takenNumbers);

  const isStartAvailable = (start: number): boolean => {
    for (let i = 0; i < ticketCount; i++) {
      if (takenSet.has(start + i)) return false;
    }
    return true;
  };

  const getBlockRange = (start: number): number[] => {
    return Array.from({ length: ticketCount }, (_, i) => start + i);
  };

  const highlightedNums = new Set<number>();
  const activeStart = hoveredStart ?? selectedStart;
  if (activeStart !== null) {
    getBlockRange(activeStart).forEach((n) => highlightedNums.add(n));
  }

  const handleLockTickets = async () => {
    if (selectedStart === null || selecting) return;
    setSelecting(true);
    try {
      const res = await fetch('/api/tickets/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, startAt: selectedStart }),
      });
      const data = await res.json();
      if (res.ok && data.ticket) {
        setTicket(data.ticket);
        setShowSelector(false);
        showToast(data.message);
      } else {
        showToast(data.error || 'Failed to lock tickets');
        fetchData();
      }
    } catch {
      showToast('Network error');
    } finally {
      setSelecting(false);
    }
  };

  if (loading) return <div className={styles.loadingPage}><span className="spinner" /></div>;
  if (error) return <div className={styles.loadingPage}><p className={styles.errorText}>{error}</p></div>;
  if (!ticket || !game) return null;

  const sheet = ticket.ticket_data;
  const tickets: TambolaTicket[] = sheet.tickets;
  const calledSet = new Set(calledNumbers);
  const lastCalled = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;
  const hasSelected = Array.isArray(ticket.selected_tickets) && ticket.selected_tickets.length > 0;
  const startNum = ticket.selected_tickets?.[0];
  const endNum = ticket.selected_tickets?.[ticket.selected_tickets.length - 1];

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.playerName}>{ticket.player_name}</span>
          <span className={styles.gameMeta}>
            Game #{game.game_number}
            {hasSelected && ` · Tickets #${startNum}–#${endNum}`}
          </span>
        </div>
        <div className={styles.headerRight}>
          {game.status === 'UPCOMING' && hasSelected && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setSelectedStart(ticket.selected_tickets![0]);
                setShowSelector(true);
              }}
              title="Change ticket selection"
            >
              🎟️ Change
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

      {/* Ticket Selection Modal */}
      {showSelector && (
        <div className={styles.selectorModal}>
          <div className={styles.selectorCard}>
            <h2 className={styles.selectorTitle}>PICK YOUR TICKET ROW</h2>
            <p className={styles.selectorSubtitle}>
              <strong>{ticket.sheet_type.toUpperCase()} SHEET</strong> — Select a starting number.
              You will get <strong>{ticketCount} consecutive tickets</strong> in a row.
            </p>

            {selectedStart !== null && (
              <div className={styles.selectionPreview}>
                Your tickets: <strong>#{selectedStart}–#{selectedStart + ticketCount - 1}</strong>
              </div>
            )}

            <div className={styles.numberGrid66}>
              {Array.from({ length: 66 }, (_, i) => i + 1).map((n) => {
                const isTaken = takenSet.has(n);
                const isValidStart = n <= maxStart && isStartAvailable(n);
                const isHighlighted = highlightedNums.has(n);
                const isSelected = selectedStart !== null && n >= selectedStart && n < selectedStart + ticketCount;

                return (
                  <button
                    key={n}
                    className={`${styles.numBtn} ${isSelected ? styles.numBtnSelected : ''} ${isHighlighted && !isSelected ? styles.numBtnHover : ''} ${isTaken ? styles.numBtnTaken : ''} ${!isTaken && !isValidStart ? styles.numBtnUnavailable : ''}`}
                    onClick={() => isValidStart && !isTaken && setSelectedStart(n)}
                    onMouseEnter={() => isValidStart && !isTaken && setHoveredStart(n)}
                    onMouseLeave={() => setHoveredStart(null)}
                    disabled={isTaken || !isValidStart}
                    title={
                      isTaken
                        ? `#${n} SOLD`
                        : isValidStart
                          ? `Start here → #${n}–#${n + ticketCount - 1}`
                          : `#${n} — Cannot start here`
                    }
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className={styles.legend}>
              <span><span className={styles.legendDot} style={{ background: '#ffffff' }} /> Available</span>
              <span><span className={styles.legendDot} style={{ background: '#ef4444', opacity: 0.4 }} /> Sold</span>
              <span><span className={styles.legendDot} style={{ background: '#333' }} /> Unavailable</span>
            </div>

            <div className={styles.selectorActions}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleLockTickets}
                disabled={selecting || selectedStart === null}
                style={{ flex: 1 }}
              >
                {selecting ? (
                  <span className="spinner" />
                ) : selectedStart !== null ? (
                  `Lock In #${selectedStart}–#${selectedStart + ticketCount - 1}`
                ) : (
                  'Tap a number to start'
                )}
              </button>
              {hasSelected && (
                <button className="btn" onClick={() => setShowSelector(false)} disabled={selecting}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Number Banner */}
      {game.status === 'LIVE' && lastCalled && (
        <div className={styles.currentBanner}>
          <span className={styles.currentLabel}>CALLED</span>
          <span className={styles.currentNum}>{lastCalled}</span>
          <span className={styles.calledCount}>{calledNumbers.length}/90</span>
        </div>
      )}

      {/* Waiting */}
      {game.status === 'UPCOMING' && !showSelector && (
        <div className={styles.waitingBanner}>
          <p>Your tickets (#{startNum}–#{endNum}) are locked & ready! Game will start soon.</p>
        </div>
      )}

      {/* Completed */}
      {game.status === 'COMPLETED' && (
        <div className={styles.waitingBanner}>
          <p>Game has ended. Thanks for playing!</p>
        </div>
      )}

      {/* Winners Board */}
      {winners.length > 0 && (
        <div className={styles.winnersBoard}>
          <span className={styles.winnersTitle}>🏆 WINNERS</span>
          <div className={styles.winnersList}>
            {winners.map((w, i) => {
              const isMe = w.playerName === ticket.player_name;
              return (
                <div key={i} className={`${styles.winnerRow} ${isMe ? styles.winnerRowMe : ''}`}>
                  <span className={styles.winnerPattern}>{w.pattern}</span>
                  <span className={styles.winnerName}>
                    {isMe ? '⭐ YOU' : w.playerName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertical Scrollable Tickets List */}
      <div className={styles.ticketsList}>
        {tickets.map((t, tIndex) => {
          const tNums = t.flat().filter((n): n is number => n !== null);
          const calledOnT = tNums.filter((n) => calledSet.has(n)).length;
          const ticketSerial = ticket.selected_tickets?.[tIndex] ?? (tIndex + 1);

          return (
            <div key={tIndex} className={styles.ticketCard}>
              <div className={styles.ticketHeader}>
                <span className={styles.ticketTitle}>TICKET #{ticketSerial}</span>
                <span className={styles.ticketProgress}>{calledOnT}/{tNums.length} called</span>
              </div>
              <div className={styles.ticketGrid}>
                {t.map((row, ri) => (
                  <div key={ri} className={styles.ticketRow}>
                    {row.map((cell, ci) => {
                      if (cell === null) return <div key={ci} className={styles.ticketCellEmpty} />;
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

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
