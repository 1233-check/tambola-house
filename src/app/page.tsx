import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>TAMBOLA HOUSE</h1>
        <p className={styles.subtitle}>Online Tambola / Housie Platform</p>

        <div className={styles.actions}>
          <Link href="/admin" className="btn btn-primary btn-lg">
            Admin Login
          </Link>
        </div>

        <div className={styles.divider} />

        <p className={styles.playerNote}>
          If you&apos;re a player, use the ticket link shared with you to join your game.
        </p>
      </div>
    </div>
  );
}
