'use client';

import React, { useState } from 'react';
import type { PatternName } from '@/lib/game/claim-validator';
import type { ClaimEvent } from '@/lib/game/types';
import styles from './ClaimPanel.module.css';

interface PatternProgress {
  matched: number;
  total: number;
  complete: boolean;
}

interface ClaimPanelProps {
  patterns: PatternName[];
  progress: Record<PatternName, PatternProgress> | null;
  claimedPatterns: Record<string, { winnerId: string; winnerName: string }>;
  events: ClaimEvent[];
  onClaim: (pattern: PatternName) => Promise<{ valid: boolean; pattern: string; message: string } | null>;
  disabled?: boolean;
  playerId: string | null;
}

const PATTERN_ICONS: Record<string, string> = {
  'Early Five': '⚡',
  'Top Line': '⬆️',
  'Middle Line': '↔️',
  'Bottom Line': '⬇️',
  'Four Corners': '◇',
  'Full House': '🏠',
};

export default function ClaimPanel({
  patterns,
  progress,
  claimedPatterns,
  events,
  onClaim,
  disabled,
  playerId,
}: ClaimPanelProps) {
  const [claiming, setClaiming] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ valid: boolean; message: string } | null>(null);

  const handleClaim = async (pattern: PatternName) => {
    if (claiming || disabled) return;
    setClaiming(pattern);
    setLastResult(null);

    try {
      const result = await onClaim(pattern);
      if (result) {
        setLastResult({ valid: result.valid, message: result.message });
        setTimeout(() => setLastResult(null), 4000);
      }
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className={styles.panelWrapper}>
      <div className={styles.panelHeader}>
        <span className={styles.panelLabel}>WINNING PATTERNS</span>
      </div>

      {/* Result Toast */}
      {lastResult && (
        <div className={`${styles.resultToast} ${lastResult.valid ? styles.valid : styles.invalid}`}>
          {lastResult.message}
        </div>
      )}

      {/* Pattern Cards */}
      <div className={styles.patternList}>
        {patterns.map((pattern) => {
          const claimed = claimedPatterns[pattern];
          const prog = progress?.[pattern];
          const isMyClaim = claimed && claimed.winnerId === playerId;
          const isComplete = prog?.complete && !claimed;

          return (
            <div
              key={pattern}
              className={`
                ${styles.patternCard}
                ${claimed ? styles.claimed : ''}
                ${isComplete ? styles.ready : ''}
                ${isMyClaim ? styles.myClaim : ''}
              `}
            >
              <div className={styles.patternInfo}>
                <span className={styles.patternIcon}>{PATTERN_ICONS[pattern] || '🎯'}</span>
                <div className={styles.patternDetails}>
                  <span className={styles.patternName}>{pattern}</span>
                  {claimed ? (
                    <span className={styles.winnerName}>
                      🏆 {isMyClaim ? 'You won!' : claimed.winnerName}
                    </span>
                  ) : prog ? (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${(prog.matched / prog.total) * 100}%` }}
                      />
                      <span className={styles.progressText}>
                        {prog.matched}/{prog.total}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {!claimed && (
                <button
                  className={`${styles.claimBtn} ${isComplete ? styles.claimReady : ''}`}
                  onClick={() => handleClaim(pattern)}
                  disabled={disabled || !!claiming || !!claimed}
                >
                  {claiming === pattern ? (
                    <span className="spinner" />
                  ) : isComplete ? (
                    'CLAIM!'
                  ) : (
                    'Claim'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Events Feed */}
      {events.length > 0 && (
        <div className={styles.eventsFeed}>
          <span className={styles.eventsLabel}>ACTIVITY</span>
          {events.slice(0, 5).map((ev, i) => (
            <div
              key={`${ev.timestamp}-${i}`}
              className={`${styles.event} ${ev.isValid ? styles.eventValid : styles.eventInvalid}`}
            >
              <span className={styles.eventIcon}>{ev.isValid ? '🎉' : '❌'}</span>
              <span className={styles.eventText}>
                <strong>{ev.playerName}</strong>
                {ev.isValid ? ` won ${ev.patternName}!` : ` bogey on ${ev.patternName}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
