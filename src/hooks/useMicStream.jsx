import { useCallback, useEffect, useRef } from "react";

/* ──────────────────────────────────────────────────────────────
 * useMicStream — 마이크 → 16kHz mono Int16 PCM 연속 스트림
 *
 * VAD 는 backend 에서 수행한다. frontend 는 발화 감지 없이
 * 마이크 입력을 일정 청크(Int16Array)로 잘라 콜백으로 흘려보내기만 한다.
 *
 * 사용 예
 *   const { start, stop } = useMicStream({
 *     onChunk: (int16) => sendBinary(int16.buffer),
 *   });
 *   start();  // 마이크 권한 요청 + 스트리밍 시작
 *   stop();   // 정지 + 자원 해제
 *
 * 설정
 *   SAMPLE_RATE 16000 (backend 요구)
 *   BUFFER_SIZE 1024  (~64ms @16kHz — WS 로 초당 ~15.6개 청크, 32KB/s)
 * ────────────────────────────────────────────────────────────── */

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 1024;

// Float32 [-1,1] → Int16 PCM
function floatTo16BitPCM(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

export function useMicStream({ onChunk } = {}) {
    const ctxRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);
    const processorRef = useRef(null);

    // onChunk 최신값 유지 (onaudioprocess 클로저 문제 방지)
    const onChunkRef = useRef(onChunk);
    useEffect(() => {
        onChunkRef.current = onChunk;
    }, [onChunk]);

    const start = useCallback(async () => {
        if (ctxRef.current) return; // 이미 실행 중

        // 1) 마이크
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 2) AudioContext 16kHz (source 가 16kHz 로 자동 리샘플됨)
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // 3) ScriptProcessor 로 프레임 받기 → Int16 변환 → 콜백
        const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            const float32 = e.inputBuffer.getChannelData(0);
            const int16 = floatTo16BitPCM(float32);
            onChunkRef.current?.(int16);
        };

        source.connect(processor);
        processor.connect(ctx.destination); // 일부 브라우저에서 onaudioprocess 발동 조건
    }, []);

    const stop = useCallback(() => {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        ctxRef.current?.close();

        processorRef.current = null;
        sourceRef.current = null;
        streamRef.current = null;
        ctxRef.current = null;
    }, []);

    // 언마운트 시 정리
    useEffect(() => stop, [stop]);

    return { start, stop };
}

export default useMicStream;
