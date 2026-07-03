'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/lib/game/game-context';
import type { SheetType } from '@/lib/game/ticket-generator';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom } = useGame();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [sheetType, setSheetType] = useState<SheetType>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = await createRoom(playerName.trim(), sheetType);
      router.push(`/game/${code}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length < 4) {
      setError('Please enter a valid room code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await joinRoom(roomCode.trim().toUpperCase(), playerName.trim(), sheetType);
      router.push(`/game/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      {/* Floating number balls background */}
      <div className={styles.bgBalls}>
        {[7, 23, 42, 56, 71, 88, 15, 34, 69, 90, 3, 51].map((num, i) => (
          <span key={num} className={styles.bgBall} style={{
            left: `${(i * 8 + 3) % 95}%`,
            top: `${(i * 13 + 5) % 90}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${4 + (i % 3)}s`,
          }}>
            {num}
          </span>
        ))}
      </div>

      <div className={styles.container}>
        {/* Logo / Hero */}
        <div className={styles.hero}>
          <div className={styles.logoWrapper}>
            <div className={styles.logoBall}>🎱</div>
            <h1 className={styles.title}>
              <span className="heading-gradient">Tambola</span>
            </h1>
          </div>
          <p className={styles.subtitle}>
            Play the classic number game online with friends & family
          </p>
          <div className={styles.badges}>
            <span className={styles.featureBadge}>🎯 Free to Play</span>
            <span className={styles.featureBadge}>👥 Up to 25 Players</span>
            <span className={styles.featureBadge}>📄 Full & Half Sheets</span>
            <span className={styles.featureBadge}>⚡ Real-time</span>
          </div>
        </div>

        {/* Action Card */}
        <div className={`glass-card ${styles.actionCard}`}>
          {mode === 'home' && (
            <div className={styles.homeActions}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setMode('create')}
                style={{ width: '100%' }}
              >
                🎲 Create a Game
              </button>
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => setMode('join')}
                style={{ width: '100%' }}
              >
                🔗 Join a Game
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className={styles.formSection}>
              <h2 className={styles.formTitle}>Create a New Game</h2>
              <p className={styles.formDesc}>
                You&apos;ll be the host — share the room code with your players.
              </p>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Your Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Sheet Type</label>
                <div className={styles.sheetTypeSelector}>
                  <button
                    className={`${styles.sheetOption} ${sheetType === 'full' ? styles.sheetOptionActive : ''}`}
                    onClick={() => setSheetType('full')}
                    type="button"
                  >
                    <span className={styles.sheetOptionIcon}>📄</span>
                    <span className={styles.sheetOptionTitle}>Full Sheet</span>
                    <span className={styles.sheetOptionDesc}>6 tickets · All 90 numbers</span>
                  </button>
                  <button
                    className={`${styles.sheetOption} ${sheetType === 'half' ? styles.sheetOptionActive : ''}`}
                    onClick={() => setSheetType('half')}
                    type="button"
                  >
                    <span className={styles.sheetOptionIcon}>📋</span>
                    <span className={styles.sheetOptionTitle}>Half Sheet</span>
                    <span className={styles.sheetOptionDesc}>3 tickets · 45 numbers</span>
                  </button>
                </div>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.formActions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setMode('home'); setError(null); }}
                >
                  ← Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : 'Create Room'}
                </button>
              </div>
            </div>
          )}

          {mode === 'join' && (
            <div className={styles.formSection}>
              <h2 className={styles.formTitle}>Join a Game</h2>
              <p className={styles.formDesc}>
                Enter the room code shared by your host.
              </p>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Your Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Room Code</label>
                <input
                  className="input input-code"
                  type="text"
                  placeholder="ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Sheet Type</label>
                <div className={styles.sheetTypeSelector}>
                  <button
                    className={`${styles.sheetOption} ${sheetType === 'full' ? styles.sheetOptionActive : ''}`}
                    onClick={() => setSheetType('full')}
                    type="button"
                  >
                    <span className={styles.sheetOptionIcon}>📄</span>
                    <span className={styles.sheetOptionTitle}>Full Sheet</span>
                    <span className={styles.sheetOptionDesc}>6 tickets · All 90 numbers</span>
                  </button>
                  <button
                    className={`${styles.sheetOption} ${sheetType === 'half' ? styles.sheetOptionActive : ''}`}
                    onClick={() => setSheetType('half')}
                    type="button"
                  >
                    <span className={styles.sheetOptionIcon}>📋</span>
                    <span className={styles.sheetOptionTitle}>Half Sheet</span>
                    <span className={styles.sheetOptionDesc}>3 tickets · 45 numbers</span>
                  </button>
                </div>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.formActions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setMode('home'); setError(null); }}
                >
                  ← Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : 'Join Room'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* How to Play */}
        <div className={styles.howToPlay}>
          <h2 className={styles.sectionTitle}>How to Play</h2>
          <div className={styles.steps}>
            {[
              { icon: '🎲', title: 'Create or Join', desc: 'Host creates a room and shares the 6-digit code' },
              { icon: '🎟️', title: 'Get Your Ticket', desc: 'Each player receives a unique ticket with 15 numbers' },
              { icon: '📢', title: 'Numbers Called', desc: 'The host calls numbers 1–90 randomly, one at a time' },
              { icon: '✅', title: 'Mark & Claim', desc: 'Mark numbers on your ticket, claim when you complete a pattern!' },
            ].map((step, i) => (
              <div key={i} className={styles.step} style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
