import { useEffect, useRef } from "react";
import useSession from "../hooks/useSession";
import useTts from "../hooks/useTts";
import useWebSocket from "../hooks/useWebSocket";
import {
    ttsStartedMic,
    ttsEndedMic,
    setTtsStopperMic,
    setTtsDuckerMic,
    isPaymentLockedMic,
} from "../utils/micGate";
import { duckMedia, unduckMedia } from "../utils/mediaVolume";
import { markTtsStart } from "../utils/perfTrace";

/* ──────────────────────────────────────────────────────────────
 * TtsPlayer — SessionResponse.message 자동 음성 안내 (전역 상주)
 *
 * RootLayout 에 배치 (렌더 없음, return null).
 *
 * 동작:
 *   - responseSeq 가 바뀔 때(= 새 SessionResponse 수신)만 반응
 *   - message 가 있으면 speak() — 재생 중이던 이전 안내는 자동 취소
 *   - 재생 중 사용자 발화가 감지되면 duck (시스템 미디어 볼륨 50%),
 *     발화 종료 시 unduck 로 원복. 재생은 끝까지 유지.
 *   - 결제 페이지 진입(lockForPaymentMic)에서는 stopper 로 즉시 중단.
 *   - 미지원 브라우저/합성 실패는 조용히 무시 — 안내 음성은 부가 기능
 *
 * ※ PageGuide/receipt/end/receiptModal 안내는 여기와 별개다 —
 *   그쪽은 micGate 콜백을 붙이지 않아 duck 대상이 아니다 (무조건 끝까지).
 * ────────────────────────────────────────────────────────────── */
export default function TtsPlayer() {
    const { message, responseSeq } = useSession();
    const { status: wsStatus } = useWebSocket();
    const { speak, stop } = useTts();

    // 이미 처리한 응답 seq (SessionRouter 와 동일한 중복 방지 패턴)
    const handledSeqRef = useRef(0);

    /* micGate 배선:
     *   ▸ setTtsStopperMic(stop) — 결제 잠금 시 즉시 중단용
     *   ▸ setTtsDuckerMic({duck, unduck}) — 발화 감지 시 볼륨 조절용
     * mount 시 1회 등록, 언마운트 시 정리 + 진행 중 재생 중단.          */
    useEffect(() => {
        setTtsStopperMic(stop);
        setTtsDuckerMic({ duck: duckMedia, unduck: unduckMedia });
        return () => {
            setTtsStopperMic(null);
            setTtsDuckerMic(null);
            stop();
        };
    }, [stop]);

    /* WS 연결이 끊기면(세션 종료 cleanup / backend 다운) 재생 중이던
     *   안내도 함께 중단 — 이미 끝난 세션의 안내가 다음 손님/화면까지
     *   이어지지 않게 한다.
     *   ※ "끊긴 상태" 자체는 재생을 막지 않는다 — Toss 리다이렉트 후처럼
     *     WS 없이 REST 응답 안내가 나가야 하는 경우가 있어서, 오직
     *     "끊기는 순간"에만 stop() 한다. (초기 mount 의 disconnected 는
     *     재생 중인 게 없어 no-op)                                        */
    useEffect(() => {
        if (wsStatus === "disconnected") stop();
    }, [wsStatus, stop]);

    useEffect(() => {
        // 새 SessionResponse 가 아닐 때(초기 렌더 포함)는 무시
        if (responseSeq === 0 || responseSeq === handledSeqRef.current) return;
        handledSeqRef.current = responseSeq;

        if (!message || !message.trim()) return;

        // 결제 잠금 중(pay 페이지 — 토스 결제창 표시)에는 재생하지 않음
        if (isPaymentLockedMic()) return;

        // 재생 시작/종료에 micGate TTS-active 상태 동기화
        //   → useMicStream 이 이 상태를 보고 duck 판정 실행
        //   (onEnd 는 정상 종료·취소·오류 모두에서 1회 보장 — useTts)
        speak(message, {
            onStart: () => {
                ttsStartedMic();
                markTtsStart(); // [perf] T2 — TTS 재생 시작 (측정용)
            },
            onEnd: ttsEndedMic,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [responseSeq]);

    return null;
}
