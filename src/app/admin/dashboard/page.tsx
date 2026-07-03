'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface GameSlot {
  id: string;
  game_number: number;
  status: string;
  tickets: { id: string; player_name: string; sheet_type: string }[];
}

export default function AdminDashboard() {
  const [games, setGames] = useState<GameSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/games');
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      setGames(data.games || []);
    } catch {
      console.error('Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const createTodayGames = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/games', { method: 'POST' });
      await fetchGames();
    } catch {
      console.error('Failed to create games');
    }
  };

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>TAMBOLA HOUSE</h1>
          <p className={styles.date}>{today}</p>
        </div>
        <div className={styles.headerActions}>
          {games.length === 0 && !loading && (
            <button className="btn btn-primary" onClick={createTodayGames}>
              Create Today&apos;s Games
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className="spinner" />
          </div>
        ) : games.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No games created for today.</p>
            <button className="btn btn-primary btn-lg" onClick={createTodayGames}>
              Create 20 Game Slots
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {games.map((game) => (
              <button
                key={game.id}
                className={styles.gameCard}
                onClick={() => router.push(`/admin/game/${game.id}`)}
              >
                <div className={styles.gameHeader}>
                  <span className={styles.gameNumber}>#{game.game_number}</span>
                  <span className={`badge badge-${game.status.toLowerCase()}`}>
                    {game.status}
                  </span>
                </div>
                <div className={styles.gameInfo}>
                  <span className={styles.ticketCount}>
                    {game.tickets?.length || 0} players
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
