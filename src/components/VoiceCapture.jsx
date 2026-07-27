import { useCallback, useEffect, useRef } from "react";
import useMicStream from "../hooks/useMicStream";
import useSession from "../hooks/useSession";
import useWebSocket from "../hooks/useWebSocket";
import { isTtsPlayingMic, subscribeTtsMic } from "../utils/micGate";

/* ──────────────────────────────────────────────────────────────
 * VoiceCapture — 마이크 PCM 연속 스트림 → WS 전송 (전역 상주)
 *
 * VAD 는 backend 에서 수행한다. frontend 역할은 셋뿐:
 *   마이크 캡처 → Int16 PCM 청크 → WS Binary 전송
 *
 * RootLayout 에 배치 (렌더 없음, return null).
 *
 * 동작:
 *   - WS connected → 스트림 metadata(JSON) 1회 전송
 *   - 안내(TTS)가 재생 중이면 끝날 때까지 기다렸다가 마이크 시작
 *   - 이후 마이크 청크(Int16 ~64ms)를 sendBinary 로 연속 전송
 *   - session_id 발급/변경 시 metadata 재전송 (backend 가 최신 값 유지)
 *   - WS disconnected → 마이크 정지
 *
 * ── 마이크 오픈을 미루는 이유 ──────────────────────────────
 * getUserMedia 가 실행되면 안드로이드가 오디오 모드를 통신 모드로
 * 전환하는데, 그 순간 재생 중이던 TTS 출력이 끊긴다. /main 진입 안내가
 * "매장ㅇ ... ㅅ택해주세요" 처럼 음절 중간부터 비었다가 꼬리만 다시
 * 나오던 증상의 원인. (재생 자체는 계속되고 출력만 죽는 형태라
 *  speak() 취소 계열 원인과 구분된다)
 *
 * 반대 순서 — 마이크를 먼저 열고 나서 TTS 가 시작되는 것 — 는 문제가
 * 없다. 라우팅이 이미 전환된 뒤라 재생이 방해받지 않는다.
 * 그래서 "재생 중이 아닐 때만 연다" 조건 하나로 충분하다.
 * ────────────────────────────────────────────────────────────── */

/* 안내가 비정상적으로 길거나 onEnd 가 유실돼도 마이크가 영영 안 열리는
 * 일이 없도록 하는 상한 (ms). 이 시간이 지나면 재생 중이어도 시작한다. */
const MIC_OPEN_MAX_WAIT_MS = 10_000;

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

    /* WS 연결 상태에 맞춰 스트림 시작/정지.
     *   metadata(JSON) 는 즉시 — 오디오 라우팅과 무관하다.
     *   마이크 오픈만 안내 재생이 끝난 뒤로 미룬다.                     */
    useEffect(() => {
        if (status !== "connected") {
            stop();
            return;
        }

        sendStreamMetadata();

        let done = false;          // 이 effect 에서 마이크를 이미 열었는가
        let unsubscribe = null;
        let timeoutId = null;

        const cleanupWaiters = () => {
            unsubscribe?.();
            unsubscribe = null;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        /* force=true 면 재생 중이어도 강행 (워치독) */
        const openMic = (force = false) => {
            if (done) return;
            if (!force && isTtsPlayingMic()) return; // 안내 재생 중 — 대기
            done = true;
            cleanupWaiters();
            start().catch((err) => {
                // 마이크 권한 거부/미지원 — 음성 없이 터치 주문만 가능
                console.warn("[VoiceCapture] 마이크 시작 실패:", err);
            });
        };

        // 재생 종료 통지를 먼저 구독한 뒤 즉시 1회 시도
        //   (구독 전에 시도하면 그 사이 종료된 통지를 놓친다)
        unsubscribe = subscribeTtsMic((playing) => {
            if (!playing) openMic();
        });
        timeoutId = setTimeout(() => openMic(true), MIC_OPEN_MAX_WAIT_MS);
        openMic();

        return () => {
            done = true;
            cleanupWaiters();
            stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    return null;
}
