'use client';

import React from 'react';
import styles from './PlayerList.module.css';
import type { Player } from '@/lib/game/types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string | null;
}

/** Generate a consistent color from a string */
function getAvatarColor(name: string): string {
  const colors = [
    '#6c5ce7', '#0984e3', '#00cec9', '#00b894',
    '#ffd166', '#e17055', '#fd79a8', '#d63031', '#e84393',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className={styles.listWrapper}>
      <div className={styles.listHeader}>
        <span className={styles.listLabel}>PLAYERS</span>
        <span className={styles.playerCount}>{players.length} / 25</span>
      </div>
      <div className={styles.playerList}>
        {players.map((player) => {
          const isMe = player.id === currentPlayerId;
          const color = getAvatarColor(player.displayName);
          return (
            <div
              key={player.id}
              className={`${styles.playerCard} ${isMe ? styles.me : ''}`}
            >
              <div
                className={styles.avatar}
                style={{ background: color }}
              >
                {getInitials(player.displayName)}
              </div>
              <div className={styles.playerInfo}>
                <span className={styles.playerName}>
                  {player.displayName}
                  {isMe && <span className={styles.youBadge}>You</span>}
                </span>
                {player.isHost && (
                  <span className={styles.hostBadge}>👑 Host</span>
                )}
              </div>
              <div
                className={`${styles.statusDot} ${player.isOnline ? styles.online : styles.offline}`}
              />
            </div>
          );
        })}

        {players.length === 0 && (
          <div className={styles.emptyState}>
            <span>Waiting for players to join...</span>
          </div>
        )}
      </div>
    </div>
  );
}
