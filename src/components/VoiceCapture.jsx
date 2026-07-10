import { useCallback, useEffect, useRef } from "react";
import useMicStream from "../hooks/useMicStream";
import useSession from "../hooks/useSession";
import useWebSocket from "../hooks/useWebSocket";

/* ──────────────────────────────────────────────────────────────
 * VoiceCapture — 마이크 PCM 연속 스트림 → WS 전송 (전역 상주)
 *
 * VAD 는 backend 에서 수행한다. frontend 역할은 셋뿐:
 *   마이크 캡처 → Int16 PCM 청크 → WS Binary 전송
 *
 * RootLayout 에 배치 (렌더 없음, return null).
 *
 * 동작:
 *   - WS connected → 스트림 metadata(JSON) 1회 전송 후 마이크 시작
 *       { session_id: UUID|null, sample_rate: 16000, channels: 1,
 *         timestamp: ISO8601 }
 *     (backend 는 이 metadata 를 이 연결의 스트림 파라미터로 보관)
 *   - 이후 마이크 청크(Int16 ~64ms)를 sendBinary 로 연속 전송
 *   - session_id 발급/변경 시 metadata 재전송 (backend 가 최신 값 유지)
 *   - WS disconnected → 마이크 정지
 * ────────────────────────────────────────────────────────────── */
export default function VoiceCapture() {
    const { status, sendJson, sendBinary } = useWebSocket();
    const { session_id } = useSession();

    const sessionIdRef = useRef(session_id);

    /* 스트림 metadata 전송 (연결 직후 1회 + session_id 변경 시) */
    const sendStreamMetadata = useCallback(() => {
        sendJson({
            session_id: sessionIdRef.current ?? null,
            sample_rate: 16000,
            channels: 1,
            timestamp: new Date().toISOString(),
        });
    }, [sendJson]);

    /* 마이크 청크 → WS Binary (연속 스트림) */
    const handleChunk = useCallback(
        (int16) => {
            sendBinary(int16.buffer);
        },
        [sendBinary]
    );

    const { start, stop } = useMicStream({ onChunk: handleChunk });

    /* session_id 발급/변경 시 → metadata 갱신 전송 */
    useEffect(() => {
        sessionIdRef.current = session_id;
        if (status === "connected" && session_id) {
            sendStreamMetadata();
        }
    }, [session_id, status, sendStreamMetadata]);

    /* WS 연결 상태에 맞춰 스트림 시작/정지 */
    useEffect(() => {
        if (status === "connected") {
            sendStreamMetadata(); // 스트림 파라미터 먼저
            start().catch((err) => {
                // 마이크 권한 거부/미지원 — 음성 없이 터치 주문만 가능
                console.warn("[VoiceCapture] 마이크 시작 실패:", err);
            });
        } else {
            stop();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    return null;
}
