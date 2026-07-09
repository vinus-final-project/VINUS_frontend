import { useCallback, useEffect, useRef } from "react";
import { useVad } from "../hooks/useVad";
import useSession from "../hooks/useSession";
import useWebSocket from "../hooks/useWebSocket";

/* ──────────────────────────────────────────────────────────────
 * VoiceCapture — VAD 발화 감지 → VoiceRequest WS 전송 (전역 상주)
 *
 * RootLayout 에 배치한다 (렌더 없음, return null).
 * 페이지 이동에도 마이크/VAD 가 꺼지지 않도록 전역에 둔다.
 *
 * 동작:
 *   - WebSocket 이 connected 되면 VAD 시작 (마이크 권한 요청)
 *   - disconnected 되면 VAD 정지
 *   - 발화 하나(onUtterance) 감지될 때마다 VoiceRequest 전송:
 *
 *     ① JSON Metadata (VoiceRequest DTO — audio 는 Binary 로 별도)
 *        {
 *          session_id:  UUID | null   ← 첫 발화 시 null (WS 연결에 바인딩)
 *          sample_rate: 16000
 *          channels:    1
 *          timestamp:   ISO8601       ← 로그용 (선택)
 *        }
 *     ② PCM Binary Frame — Int16 PCM (VAD 가 분리한 발화 구간)
 *
 *   backend 는 "JSON Metadata 수신 후 가장 먼저 도착하는 PCM Binary
 *   Frame 을 동일 요청으로 처리" (WebSocket.md 정책)
 * ────────────────────────────────────────────────────────────── */
export default function VoiceCapture() {
    const { status, sendJson, sendBinary } = useWebSocket();
    const { session_id } = useSession();

    /* onUtterance 는 ScriptProcessor 클로저 안에서 불리므로
     * session_id 최신값을 ref 로 추적한다 (stale closure 방지) */
    const sessionIdRef = useRef(session_id);
    useEffect(() => {
        sessionIdRef.current = session_id;
    }, [session_id]);

    /* 발화 1건 → VoiceRequest(JSON Metadata + PCM Binary) 전송 */
    const handleUtterance = useCallback(
        (pcm /* Int16Array, 16kHz mono */) => {
            // ① JSON Metadata
            const metaSent = sendJson({
                session_id: sessionIdRef.current ?? null,
                sample_rate: 16000,
                channels: 1,
                timestamp: new Date().toISOString(),
            });
            if (!metaSent) return; // 연결 안 됨 — 발화 폐기

            // ② PCM Binary Frame (Int16 → ArrayBuffer)
            sendBinary(pcm.buffer);
        },
        [sendJson, sendBinary]
    );

    const { start, stop } = useVad({ onUtterance: handleUtterance });

    /* WS 연결 상태에 맞춰 VAD 시작/정지 */
    useEffect(() => {
        if (status === "connected") {
            start().catch((err) => {
                // 마이크 권한 거부/미지원 — 음성 없이 터치 주문만 가능
                console.warn("[VoiceCapture] 마이크 시작 실패:", err);
            });
        } else {
            stop();
        }
    }, [status, start, stop]);

    return null;
}
