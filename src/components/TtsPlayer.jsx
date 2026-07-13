import { useEffect, useRef } from "react";
import useSession from "../hooks/useSession";
import useTts from "../hooks/useTts";
import {
    ttsStartedMic,
    ttsEndedMic,
    setTtsStopperMic,
} from "../utils/micGate";

/* ──────────────────────────────────────────────────────────────
 * TtsPlayer — SessionResponse.message 자동 음성 안내 (전역 상주)
 *
 * RootLayout 에 배치 (렌더 없음, return null).
 * 합성은 Web Speech API(useTts) — 서버/네트워크 왕복 없이 즉시 재생.
 *
 * 동작:
 *   - responseSeq 가 바뀔 때(= 새 SessionResponse 수신)만 반응
 *   - message 가 있으면 speak() — 재생 중이던 이전 안내는 자동 취소
 *   - barge-in: 재생 동안 micGate 가 barge-in 모드(높은 임계값)로
 *     동작하고, 사용자 발화 감지 시 stop() 으로 TTS 를 즉시 끊는다
 *   - 미지원 브라우저/합성 실패는 조용히 무시 — 안내 음성은 부가 기능
 * ────────────────────────────────────────────────────────────── */
export default function TtsPlayer() {
    const { message, responseSeq } = useSession();
    const { speak, stop } = useTts();

    // 이미 처리한 응답 seq (SessionRouter 와 동일한 중복 방지 패턴)
    const handledSeqRef = useRef(0);

    /* barge-in: 사용자 발화 감지 시 useMicStream → micGate 가 stop 으로
     *   TTS 를 즉시 중단시킨다 (mount 시 1회 등록, 언마운트 시 정리)      */
    useEffect(() => {
        setTtsStopperMic(stop);
        return () => {
            setTtsStopperMic(null);
            stop();
        };
    }, [stop]);

    useEffect(() => {
        // 새 SessionResponse 가 아닐 때(초기 렌더 포함)는 무시
        if (responseSeq === 0 || responseSeq === handledSeqRef.current) return;
        handledSeqRef.current = responseSeq;

        if (!message || !message.trim()) return;

        // 재생 동안 barge-in 모드 진입/해제는 utterance 이벤트에 연동
        //   (onEnd 는 정상 종료·취소·오류 모두에서 1회 보장 — useTts)
        speak(message, {
            onStart: ttsStartedMic,
            onEnd: ttsEndedMic,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [responseSeq]);

    return null;
}
