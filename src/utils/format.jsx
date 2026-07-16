/* ──────────────────────────────────────────────────────────────
 * format.js — 표시 형식 통일용 헬퍼.
 *
 *  - formatKRW(2500)  → "2,500원"
 *  - formatCount(3)   → "3개"
 *  - formatSeconds(s) → "3초"
 *  - formatMMSS(180)  → "3:00"  (필요 시 navbar 타이머 표시 등)
 * ────────────────────────────────────────────────────────────── */

export const formatKRW = (n) => `${(n ?? 0).toLocaleString()}원`;

/* 수량 표시 — unit 생략 시 "개" (합계처럼 혼합 품목엔 기본 단위 사용) */
export const formatCount = (n, unit = "개") => `${n ?? 0}${unit}`;

export const formatSeconds = (s) => `${s ?? 0}초`;

export const formatMMSS = (s) => {
  const total = Math.max(0, Math.floor(s ?? 0));
  const m = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, "0");
  return `${m}:${ss}`;
};
