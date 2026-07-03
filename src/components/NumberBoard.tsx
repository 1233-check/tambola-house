'use client';

import React from 'react';
import styles from './NumberBoard.module.css';

interface NumberBoardProps {
  calledNumbers: number[];
  currentNumber: number | null;
}

/** Color class for each column range */
const getColumnColor = (num: number): string => {
  if (num <= 9) return styles.col1;
  if (num <= 19) return styles.col2;
  if (num <= 29) return styles.col3;
  if (num <= 39) return styles.col4;
  if (num <= 49) return styles.col5;
  if (num <= 59) return styles.col6;
  if (num <= 69) return styles.col7;
  if (num <= 79) return styles.col8;
  return styles.col9;
};

export default function NumberBoard({ calledNumbers, currentNumber }: NumberBoardProps) {
  const calledSet = new Set(calledNumbers);

  // Build 9×10 grid (numbers 1–90)
  const rows: number[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: number[] = [];
    for (let c = 0; c < 10; c++) {
      const num = r * 10 + c + 1;
      if (num <= 90) row.push(num);
    }
    rows.push(row);
  }

  return (
    <div className={styles.boardWrapper}>
      <div className={styles.boardHeader}>
        <span className={styles.boardLabel}>NUMBER BOARD</span>
        <span className={styles.calledCount}>
          {calledNumbers.length} / 90
        </span>
      </div>

      {/* Current Number Display */}
      {currentNumber !== null && (
        <div className={styles.currentNumber}>
          <div className={styles.currentBall}>
            <span className={styles.currentBallNumber}>{currentNumber}</span>
          </div>
          <span className={styles.currentLabel}>Last Called</span>
        </div>
      )}

      <div className={styles.board}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className={styles.row}>
            {row.map((num) => {
              const isCalled = calledSet.has(num);
              const isCurrent = num === currentNumber;
              return (
                <div
                  key={num}
                  className={`
                    ${styles.cell}
                    ${getColumnColor(num)}
                    ${isCalled ? styles.called : ''}
                    ${isCurrent ? styles.current : ''}
                  `}
                >
                  {num}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Called Numbers History */}
      {calledNumbers.length > 0 && (
        <div className={styles.history}>
          <span className={styles.historyLabel}>History:</span>
          <div className={styles.historyNumbers}>
            {[...calledNumbers].reverse().slice(0, 10).map((num, i) => (
              <span key={num} className={`${styles.historyNum} ${getColumnColor(num)}`} style={{ opacity: 1 - i * 0.08 }}>
                {num}
              </span>
            ))}
            {calledNumbers.length > 10 && (
              <span className={styles.historyMore}>+{calledNumbers.length - 10}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
