'use client';

import React, { useCallback } from 'react';
import type { TambolaTicket } from '@/lib/game/ticket-generator';
import styles from './Ticket.module.css';

interface TicketProps {
  ticket: TambolaTicket;
  markedNumbers: Set<number>;
  calledNumbers: number[];
  onMarkNumber: (num: number) => void;
  disabled?: boolean;
}

export default function Ticket({ ticket, markedNumbers, calledNumbers, onMarkNumber, disabled }: TicketProps) {
  const calledSet = new Set(calledNumbers);

  const handleCellClick = useCallback(
    (num: number | null) => {
      if (disabled || num === null) return;
      if (!calledSet.has(num)) return; // Can only mark called numbers
      onMarkNumber(num);
    },
    [disabled, calledSet, onMarkNumber]
  );

  return (
    <div className={styles.ticketWrapper}>
      <div className={styles.ticketHeader}>
        <span className={styles.ticketLabel}>YOUR TICKET</span>
        <span className={styles.markedCount}>
          {markedNumbers.size} / 15
        </span>
      </div>
      <div className={styles.ticket}>
        {ticket.map((row, rowIdx) => (
          <div key={rowIdx} className={styles.row}>
            {row.map((cell, colIdx) => {
              const isEmpty = cell === null;
              const isMarked = cell !== null && markedNumbers.has(cell);
              const isCalled = cell !== null && calledSet.has(cell);
              const isCallable = cell !== null && isCalled && !isMarked;

              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  className={`
                    ${styles.cell}
                    ${isEmpty ? styles.empty : ''}
                    ${isMarked ? styles.marked : ''}
                    ${isCalled && !isMarked ? styles.called : ''}
                    ${isCallable ? styles.callable : ''}
                  `}
                  onClick={() => handleCellClick(cell)}
                  disabled={disabled || isEmpty || !isCalled}
                  aria-label={
                    isEmpty
                      ? 'Empty cell'
                      : `Number ${cell}${isMarked ? ', marked' : ''}${isCalled ? ', called' : ''}`
                  }
                >
                  {cell !== null && (
                    <>
                      <span className={styles.number}>{cell}</span>
                      {isMarked && <span className={styles.stamp}>✓</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
