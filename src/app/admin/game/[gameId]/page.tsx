'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import styles from './page.module.css';
import type { TambolaSheet } from '@/lib/game/ticket-generator';

interface TicketData {
  id: string;
  player_name: string;
  player_phone: string;
  sheet_type: string;
  access_token: string;
  ticket_data: TambolaSheet;
  selected_tickets: number[] | null;
}

interface ClaimData {
  id: string;
  pattern: string;
  player_name: string;
  is_valid: boolean;
  ticket_index: number;
  validated_at: string;
}

interface GameData {
  id: string;
  game_number: number;
  date: string;
  status: string;
  called_numbers: number[];
  number_sequence: number[];
  tickets: TicketData[];
  claims: ClaimData[];
}

export default function GameManagementPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [autoCall, setAutoCall] = useState(false);
  const autoCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callingRef = useRef(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newSheetType, setNewSheetType] = useState<'full' | 'half'>('full');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [toast, setToast] = useState('');
  const router = useRouter();

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/games/${gameId}`);
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      setGame(data.game);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [gameId, router]);

  useEffect(() => { fetchGame(); }, [fetchGame]);

  // Auto-refresh every 5s to see updated player selections
  useEffect(() => {
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  // Auto-call: chained setTimeout — next call only fires after previous completes
  useEffect(() => {
    if (!autoCall || game?.status !== 'LIVE') return;

    let cancelled = false;

    const callNext = async () => {
      if (cancelled || callingRef.current) return;
      callingRef.current = true;
      setCalling(true);
      try {
        const res = await fetch(`/api/admin/games/${gameId}/call`, { method: 'POST' });
        const data = await res.json();
        if (data.completed) {
          setAutoCall(false);
          showToast('All 90 numbers called — game complete');
        }
        await fetchGame();
      } catch { /* ignore */ } finally {
        callingRef.current = false;
        setCalling(false);
      }
      // Schedule the next call after a delay (only if not cancelled)
      if (!cancelled) {
        autoCallTimerRef.current = setTimeout(callNext, 3500);
      }
    };

    // Start the chain
    autoCallTimerRef.current = setTimeout(callNext, 500);

    return () => {
      cancelled = true;
      if (autoCallTimerRef.current) clearTimeout(autoCallTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCall, game?.status, gameId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleStartGame = async () => {
    await fetch(`/api/admin/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'LIVE' }),
    });
    await fetchGame();
  };

  const handleEndGame = async () => {
    setAutoCall(false);
    await fetch(`/api/admin/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    await fetchGame();
  };

  const handleCallNumber = async () => {
    if (callingRef.current) return;
    callingRef.current = true;
    setCalling(true);
    try {
      const res = await fetch(`/api/admin/games/${gameId}/call`, { method: 'POST' });
      const data = await res.json();
      if (data.completed) {
        setAutoCall(false);
        showToast('All 90 numbers called — game complete');
      }
      await fetchGame();
    } finally {
      callingRef.current = false;
      setCalling(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/admin/games/${gameId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: newPlayerName.trim(),
          playerPhone: newPlayerPhone.trim(),
          sheetType: newSheetType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await navigator.clipboard.writeText(data.playerLink);
        showToast(`Ticket link created & copied to clipboard!`);
        setNewPlayerName('');
        setNewPlayerPhone('');
        setShowAddPlayer(false);
        await fetchGame();
      } else {
        showToast(data.error || 'Failed to add player');
      }
    } finally {
      setAddingPlayer(false);
    }
  };

  const copyPlayerLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/play/${token}`;
    await navigator.clipboard.writeText(link);
    showToast('Link copied!');
  };

  const copyWhatsAppLink = (ticket: TicketData) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/play/${ticket.access_token}`;
    const text = `🎟️ Tambola House - Game #${game?.game_number}\n\nHi ${ticket.player_name}!\n\nOpen this link to choose your lucky tickets:\n${link}`;
    const waUrl = `https://wa.me/${ticket.player_phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return <div className={styles.loadingPage}><span className="spinner" /></div>;
  }

  if (!game) {
    return <div className={styles.loadingPage}>Game not found</div>;
  }

  const calledSet = new Set(game.called_numbers || []);
  const lastCalled = game.called_numbers?.length > 0
    ? game.called_numbers[game.called_numbers.length - 1]
    : null;

  // Count how many of the 66 pool tickets are booked
  const allBookedTickets = new Set<number>();
  game.tickets?.forEach((t) => {
    if (Array.isArray(t.selected_tickets)) {
      t.selected_tickets.forEach((n) => allBookedTickets.add(n));
    }
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className="btn btn-sm" onClick={() => router.push('/admin/dashboard')}>
            ← Back
          </button>
          <div>
            <h1 className={styles.gameTitle}>Game #{game.game_number}</h1>
            <span className={`badge badge-${game.status.toLowerCase()}`}>{game.status}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {game.status === 'UPCOMING' && (
            <button className="btn btn-primary" onClick={handleStartGame}>
              Start Game
            </button>
          )}
          {game.status === 'LIVE' && (
            <>
              <button className="btn btn-danger" onClick={handleEndGame}>
                End Game
              </button>
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {/* Live Controls */}
        {game.status === 'LIVE' && (
          <section className={styles.liveControls}>
            <div className={styles.currentNumber}>
              <span className="label">Current Number</span>
              <span className={styles.bigNumber}>
                {lastCalled ?? '—'}
              </span>
              <span className={styles.callCount}>
                {game.called_numbers.length} / 90 called
              </span>
            </div>
            <div className={styles.callActions}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleCallNumber}
                disabled={calling}
              >
                {calling ? <span className="spinner" /> : 'Call Number'}
              </button>
              <button
                className={`btn ${autoCall ? 'btn-danger' : ''}`}
                onClick={() => setAutoCall(!autoCall)}
              >
                {autoCall ? 'Stop Auto-Call' : 'Auto-Call'}
              </button>
            </div>
          </section>
        )}

        {/* Number Board */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Number Board</h2>
          <div className={styles.numberBoard}>
            {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`${styles.numberCell} ${calledSet.has(n) ? styles.called : ''} ${n === lastCalled ? styles.current : ''}`}
              >
                {n}
              </div>
            ))}
          </div>
        </section>

        {/* Ticket Pool Summary */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Ticket Pool — {allBookedTickets.size}/66 Booked
          </h2>
          <div className={styles.poolGrid}>
            {Array.from({ length: 66 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`${styles.poolCell} ${allBookedTickets.has(n) ? styles.poolBooked : ''}`}
                title={allBookedTickets.has(n) ? `Ticket #${n} — SOLD` : `Ticket #${n} — Available`}
              >
                {n}
              </div>
            ))}
          </div>
        </section>

        {/* Players / Tickets */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Players ({game.tickets?.length || 0}/25)
            </h2>
            {game.status !== 'COMPLETED' && (
              <button
                className="btn btn-sm"
                onClick={() => setShowAddPlayer(!showAddPlayer)}
              >
                {showAddPlayer ? 'Cancel' : '+ Add Player'}
              </button>
            )}
          </div>

          {showAddPlayer && (
            <form className={styles.addPlayerForm} onSubmit={handleAddPlayer}>
              <div className={styles.formRow}>
                <input
                  className="input"
                  placeholder="Player name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  autoFocus
                />
                <input
                  className="input"
                  placeholder="Phone (optional)"
                  value={newPlayerPhone}
                  onChange={(e) => setNewPlayerPhone(e.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.sheetToggle}>
                  <button
                    type="button"
                    className={`${styles.sheetBtn} ${newSheetType === 'full' ? styles.sheetBtnActive : ''}`}
                    onClick={() => setNewSheetType('full')}
                  >
                    Full (6)
                  </button>
                  <button
                    type="button"
                    className={`${styles.sheetBtn} ${newSheetType === 'half' ? styles.sheetBtnActive : ''}`}
                    onClick={() => setNewSheetType('half')}
                  >
                    Half (3)
                  </button>
                </div>
                <button className="btn btn-primary" type="submit" disabled={addingPlayer}>
                  {addingPlayer ? <span className="spinner" /> : 'Generate Link'}
                </button>
              </div>
            </form>
          )}

          <div className={styles.playerList}>
            {game.tickets?.length === 0 && (
              <p className={styles.emptyText}>No players yet. Add players to generate ticket links.</p>
            )}
            {game.tickets?.map((ticket) => {
              const hasSelected = Array.isArray(ticket.selected_tickets) && ticket.selected_tickets.length > 0;
              return (
                <div key={ticket.id} className={styles.playerRow}>
                  <div className={styles.playerInfo}>
                    <span className={styles.playerName}>{ticket.player_name}</span>
                    <span className={styles.playerMeta}>
                      {ticket.sheet_type === 'full' ? 'Full Sheet' : 'Half Sheet'}
                      {ticket.player_phone && ` · ${ticket.player_phone}`}
                    </span>
                    {hasSelected ? (
                      <span className={styles.playerTickets}>
                        Tickets: #{ticket.selected_tickets!.join(', #')}
                      </span>
                    ) : (
                      <span className={styles.playerPending}>
                        ⏳ Awaiting ticket selection
                      </span>
                    )}
                  </div>
                  <div className={styles.playerActions}>
                    <button
                      className="btn btn-sm"
                      onClick={() => copyPlayerLink(ticket.access_token)}
                      title="Copy link"
                    >
                      Copy Link
                    </button>
                    {ticket.player_phone && (
                      <button
                        className="btn btn-sm"
                        onClick={() => copyWhatsAppLink(ticket)}
                        title="Send via WhatsApp"
                      >
                        WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Claims Log */}
        {game.claims && game.claims.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Claims</h2>
            <div className={styles.claimsList}>
              {game.claims.map((claim) => (
                <div
                  key={claim.id}
                  className={`${styles.claimRow} ${claim.is_valid ? styles.claimValid : styles.claimInvalid}`}
                >
                  <span className={styles.claimPattern}>{claim.pattern}</span>
                  <span className={styles.claimPlayer}>{claim.player_name}</span>
                  <span className={`badge ${claim.is_valid ? 'badge-live' : ''}`}>
                    {claim.is_valid ? 'VALID' : 'INVALID'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
