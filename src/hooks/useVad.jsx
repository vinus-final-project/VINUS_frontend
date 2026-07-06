import { useRef, useEffect, useCallback } from "react";
import VADBuilder, { VADMode, VADEvent } from "@ozymandiasthegreat/vad";

// ---- 설정값 (튜닝 대상) ----
const SAMPLE_RATE = 16000;         // 백엔드 요구: 16kHz
const BUFFER_SIZE = 1024;          // 청크 크기 (~64ms @16kHz)
const START_VOICE_CHUNKS = 2;      // 연속 VOICE 청크 → 발화 시작 (~128ms)
const END_SILENCE_CHUNKS = 10;     // 연속 SILENCE 청크 → 발화 끝 (~640ms)
const PREROLL_CHUNKS = 2;          // 발화 앞부분 안 잘리게 미리 보관

// Int16Array 청크들을 하나로 합침
function mergeInt16(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function useVad({ onUtterance } = {}) {
  // 오디오 자원
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const vadRef = useRef(null);
  const VADClassRef = useRef(null);

  // 세그멘테이션 상태
  const stateRef = useRef("idle");     // idle | speaking
  const voiceRunRef = useRef(0);
  const silenceRunRef = useRef(0);
  const speechRef = useRef([]);        // 발화 구간 Int16 청크 누적
  const preRollRef = useRef([]);       // 최근 청크 (pre-roll)

  // onUtterance 최신값 유지 (onaudioprocess 클로저 문제 방지)
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  // 프레임 판정 처리
  const handleVerdict = (verdict, int16) => {
    const isVoice = verdict === VADEvent.VOICE;

    // pre-roll 링버퍼 유지
    preRollRef.current.push(int16);
    if (preRollRef.current.length > PREROLL_CHUNKS) {
      preRollRef.current.shift();
    }

    if (isVoice) {
      voiceRunRef.current += 1;
      silenceRunRef.current = 0;

      if (stateRef.current === "idle" && voiceRunRef.current >= START_VOICE_CHUNKS) {
        // 발화 시작 — pre-roll부터 담아서 앞부분 안 잘리게
        stateRef.current = "speaking";
        speechRef.current = [...preRollRef.current];
      } else if (stateRef.current === "speaking") {
        speechRef.current.push(int16);
      }
    } else {
      silenceRunRef.current += 1;
      voiceRunRef.current = 0;

      if (stateRef.current === "speaking") {
        speechRef.current.push(int16); // 끝 무렵 침묵 약간 포함
        if (silenceRunRef.current >= END_SILENCE_CHUNKS) {
          // 발화 끝 → PCM 합쳐서 콜백
          const pcm = mergeInt16(speechRef.current);
          stateRef.current = "idle";
          speechRef.current = [];
          if (onUtteranceRef.current) {
            onUtteranceRef.current(pcm); // Int16Array (16kHz mono)
          }
        }
      }
    }
  };

  const start = useCallback(async () => {
    if (ctxRef.current) return; // 이미 실행 중

    // 1) VAD(WASM) 로드 + 인스턴스
    const VAD = await VADBuilder();
    VADClassRef.current = VAD;
    vadRef.current = new VAD(VADMode.AGGRESSIVE, SAMPLE_RATE);

    // 2) 마이크
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // 3) AudioContext 16kHz (source가 16kHz로 자동 리샘플됨)
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // 4) ScriptProcessor로 프레임 받기
    const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);     // Float32Array
      const int16 = VAD.floatTo16BitPCM(float32);          // Int16Array 변환
      const verdict = vadRef.current.processBuffer(int16); // VOICE/SILENCE/ERROR
      handleVerdict(verdict, int16);
    };

    source.connect(processor);
    processor.connect(ctx.destination); // 일부 브라우저에서 onaudioprocess 발동 조건

    // 상태 초기화
    stateRef.current = "idle";
    voiceRunRef.current = 0;
    silenceRunRef.current = 0;
    speechRef.current = [];
    preRollRef.current = [];
  }, []);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
    vadRef.current?.destroy?.();

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    vadRef.current = null;

    stateRef.current = "idle";
    speechRef.current = [];
    preRollRef.current = [];
  }, []);

  // 언마운트 시 정리
  useEffect(() => stop, [stop]);

  return { start, stop };
}