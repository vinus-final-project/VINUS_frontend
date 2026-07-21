/* ──────────────────────────────────────────────────────────────
 * perfTrace — 음성 파이프라인 체감 지연 측정 (측정 끝나면 제거 가능)
 *
 * 구간:
 *   T0 발화 종료(EOS 패딩 전송)  → useMicStream
 *   T1 SessionResponse 수신      → useWebSocket
 *   T2 TTS 재생 시작             → TtsPlayer
 *
 *   T1-T0 = backend 처리(STT + RuleEngine) + 네트워크 왕복
 *           (EOS 패딩이 burst 라 VAD 종료판정 대기는 사실상 0)
 *   T2-T1 = TTS 합성/재생 시작
 *   T2-T0 = 사용자 체감 지연 (발화 끝 → 안내 시작)
 *
 * performance.now() 사용 — 단조 증가 시계라 시스템 시간 변경에 안전.
 * 모듈 스코프 (오디오 콜백 경로라 리렌더 없는 동기 마커 필요).
 * ────────────────────────────────────────────────────────────── */

let t0 = 0; // 발화 종료 시각 (0 = 측정 중 아님)
let t1 = 0;

/* T0 — 발화 종료 (노이즈게이트 닫힘 + EOS 패딩 전송 직후) */
export const markUtteranceEnd = () => {
    t0 = performance.now();
    t1 = 0;
    console.log("[perf] T0 발화 종료 (EOS 전송)");
};

/* T1 — WS SessionResponse 수신 (발화 측정 중일 때만) */
export const markResponse = () => {
    if (!t0) return;
    t1 = performance.now();
    console.log(`[perf] T1 응답 수신  +${(t1 - t0).toFixed(0)}ms (backend+네트워크)`);
};

/* T2 — TTS 재생 시작. 측정 1회 종료 (t0 리셋) */
export const markTtsStart = () => {
    if (!t0) return;
    const t2 = performance.now();
    const fromResponse = t1 ? ` (응답→TTS +${(t2 - t1).toFixed(0)}ms)` : "";
    console.log(
        `[perf] T2 TTS 시작  +${(t2 - t0).toFixed(0)}ms = 체감 지연${fromResponse}`
    );
    t0 = 0;
    t1 = 0;
};
