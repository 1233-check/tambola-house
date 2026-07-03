'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame } from '@/lib/game/game-context';
import Ticket from '@/components/Ticket';
import NumberBoard from '@/components/NumberBoard';
import ClaimPanel from '@/components/ClaimPanel';
import PlayerList from '@/components/PlayerList';
import { generateTicket } from '@/lib/game/ticket-generator';
import styles from './page.module.css';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();
  const { state, dispatch, startGame, callNumber, markNumber, submitClaim, leaveRoom, patternProgress } = useGame();
  const [autoCallActive, setAutoCallActive] = useState(false);
  const autoCallRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Initialize if arriving directly (demo mode)
  useEffect(() => {
    if (!state.roomCode && roomCode) {
      // User navigated directly — set up as host in demo mode
      const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'SET_PLAYER', playerId, playerName: 'Host' });
      dispatch({ type: 'SET_ROOM', roomCode, gameId: `demo_${roomCode}`, isHost: true });
      const ticket = generateTicket();
      dispatch({ type: 'SET_TICKET', ticket });
    }
  }, [roomCode, state.roomCode, dispatch]);

  // Auto-call logic
  useEffect(() => {
    if (autoCallActive && state.status === 'IN_PROGRESS') {
      autoCallRef.current = setInterval(() => {
        callNumber();
      }, state.settings.callIntervalMs);
    }
    return () => {
      if (autoCallRef.current) {
        clearInterval(autoCallRef.current);
        autoCallRef.current = null;
      }
    };
  }, [autoCallActive, state.status, state.settings.callIntervalMs, callNumber]);

  // Stop auto-call when game ends
  useEffect(() => {
    if (state.status === 'COMPLETED') {
      setAutoCallActive(false);
    }
  }, [state.status]);

  // Confetti on valid claim
  useEffect(() => {
    const lastEvent = state.events[0];
    if (lastEvent?.isValid) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [state.events]);

  const handleStartGame = useCallback(async () => {
    if (!state.ticket) {
      const ticket = generateTicket();
      dispatch({ type: 'SET_TICKET', ticket });
    }
    await startGame();
  }, [startGame, state.ticket, dispatch]);

  const handleCallNumber = useCallback(async () => {
    const num = await callNumber();
    if (num === null) {
      // All numbers called
      dispatch({ type: 'SET_STATUS', status: 'COMPLETED' });
    }
  }, [callNumber, dispatch]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    router.push('/');
  }, [leaveRoom, router]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode || '');
  }, [roomCode]);

  const toggleAutoCall = useCallback(() => {
    setAutoCallActive(prev => !prev);
  }, []);

  // Speed control
  const handleSpeedChange = useCallback((speed: number) => {
    dispatch({ type: 'SET_SETTINGS', settings: { callIntervalMs: speed } });
  }, [dispatch]);

  const allPatternsClaimed = state.settings.patterns.every(p => state.claimedPatterns[p]);

  return (
    <div className={styles.gamePage}>
      {/* Confetti overlay */}
      {showConfetti && (
        <div className={styles.confettiOverlay}>
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className={styles.confettiPiece}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#6c5ce7', '#00cec9', '#ffd166', '#fd79a8', '#00b894', '#e17055'][i % 6],
              }}
            />
          ))}
        </div>
      )}

      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <button className="btn btn-secondary btn-sm" onClick={handleLeave}>
            ← Leave
          </button>
          <div className={styles.roomInfo}>
            <span className={styles.roomLabel}>Room</span>
            <button className={styles.roomCode} onClick={handleCopyCode} title="Click to copy">
              {roomCode}
              <span className={styles.copyIcon}>📋</span>
            </button>
          </div>
        </div>
        <div className={styles.topRight}>
          <span className={`badge ${state.status === 'IN_PROGRESS' ? 'badge-live' : 'badge-waiting'}`}>
            {state.status === 'LOBBY' && '⏳ Waiting'}
            {state.status === 'IN_PROGRESS' && '🔴 Live'}
            {state.status === 'COMPLETED' && '✅ Finished'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.gameContent}>
        {/* Lobby State */}
        {state.status === 'LOBBY' && (
          <div className={styles.lobbySection}>
            <div className={`glass-card ${styles.lobbyCard}`}>
              <h2 className={styles.lobbyTitle}>
                {state.isHost ? '🎲 Ready to Start!' : '⏳ Waiting for Host...'}
              </h2>
              <p className={styles.lobbyDesc}>
                {state.isHost
                  ? 'Share the room code with your players, then start when everyone has joined.'
                  : 'The host will start the game soon. Sit tight!'}
              </p>

              {state.isHost && (
                <div className={styles.lobbyShareBox}>
                  <span className={styles.shareLabel}>Share this code:</span>
                  <span className={styles.shareCode}>{roomCode}</span>
                  <button className="btn btn-sm btn-secondary" onClick={handleCopyCode}>
                    Copy
                  </button>
                </div>
              )}

              {state.isHost && (
                <div className={styles.lobbySettings}>
                  <label className={styles.settingLabel}>
                    Call Speed:
                    <select
                      className={styles.speedSelect}
                      value={state.settings.callIntervalMs}
                      onChange={(e) => handleSpeedChange(Number(e.target.value))}
                    >
                      <option value={3000}>Fast (3s)</option>
                      <option value={5000}>Normal (5s)</option>
                      <option value={7000}>Slow (7s)</option>
                      <option value={10000}>Very Slow (10s)</option>
                    </select>
                  </label>
                </div>
              )}

              {state.isHost && (
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleStartGame}
                  style={{ width: '100%', marginTop: 'var(--space-md)' }}
                >
                  🚀 Start Game
                </button>
              )}
            </div>

            <PlayerList
              players={state.players.length > 0 ? state.players : [
                { id: state.playerId || '', displayName: state.playerName || 'Host', isHost: state.isHost, isOnline: true },
              ]}
              currentPlayerId={state.playerId}
            />
          </div>
        )}

        {/* Game In Progress / Completed */}
        {(state.status === 'IN_PROGRESS' || state.status === 'COMPLETED') && (
          <div className={styles.gameGrid}>
            {/* Left Column: Ticket + Claims */}
            <div className={styles.leftCol}>
              {state.ticket && (
                <Ticket
                  ticket={state.ticket}
                  markedNumbers={state.markedNumbers}
                  calledNumbers={state.calledNumbers}
                  onMarkNumber={markNumber}
                  disabled={state.status === 'COMPLETED'}
                />
              )}

              <ClaimPanel
                patterns={state.settings.patterns}
                progress={patternProgress}
                claimedPatterns={state.claimedPatterns}
                events={state.events}
                onClaim={submitClaim}
                disabled={state.status === 'COMPLETED'}
                playerId={state.playerId}
              />
            </div>

            {/* Right Column: Number Board + Host Controls */}
            <div className={styles.rightCol}>
              {/* Host Controls */}
              {state.isHost && state.status === 'IN_PROGRESS' && (
                <div className={styles.hostControls}>
                  <span className={styles.hostLabel}>HOST CONTROLS</span>
                  <div className={styles.hostBtnGroup}>
                    <button
                      className="btn btn-primary"
                      onClick={handleCallNumber}
                      disabled={autoCallActive || allPatternsClaimed}
                    >
                      📢 Call Number
                    </button>
                    <button
                      className={`btn ${autoCallActive ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={toggleAutoCall}
                      disabled={allPatternsClaimed}
                    >
                      {autoCallActive ? '⏸ Stop Auto' : '▶️ Auto Call'}
                    </button>
                  </div>
                  {autoCallActive && (
                    <div className={styles.autoCallIndicator}>
                      <span className={styles.autoCallDot} />
                      <span>Auto-calling every {state.settings.callIntervalMs / 1000}s</span>
                    </div>
                  )}
                </div>
              )}

              {/* Game Completed Banner */}
              {(state.status === 'COMPLETED' || allPatternsClaimed) && (
                <div className={styles.completedBanner}>
                  <h2>🎉 Game Over!</h2>
                  <p>All patterns have been claimed.</p>
                  <button className="btn btn-primary" onClick={handleLeave}>
                    Back to Home
                  </button>
                </div>
              )}

              <NumberBoard
                calledNumbers={state.calledNumbers}
                currentNumber={state.currentNumber}
              />

              <PlayerList
                players={state.players.length > 0 ? state.players : [
                  { id: state.playerId || '', displayName: state.playerName || 'Player', isHost: state.isHost, isOnline: true },
                ]}
                currentPlayerId={state.playerId}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
