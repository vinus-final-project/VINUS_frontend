import { useCallback, useEffect, useRef } from "react";

/* ──────────────────────────────────────────────────────────────
 * useMicStream — 마이크 → Noise Gate → 16kHz mono Int16 PCM 스트림
 *
 * 아키텍처:
 *   1. 마이크 입력 (MediaStream)
 *   2. AudioWorklet 이 오디오 스레드에서 128프레임씩 수집
 *      → 1024샘플(~64ms) 청크로 모아 메인 스레드로 postMessage
 *   3. 메인 스레드: 데시벨 계산 (청크 RMS → dB)
 *   4. Noise Gate (THRESHOLD_DB 체크) 통과 시에만 onChunk 콜백
 *   5. 발화 정밀 분리(VAD)와 STT 는 backend 담당
 *
 * ※ ScriptProcessorNode(onaudioprocess/inputBuffer)는 Web Audio 명세에서
 *   deprecated — 메인 스레드에서 처리해 UI 와 경합하기 때문.
 *   공식 대체인 AudioWorkletNode 사용 (전용 오디오 스레드, Chrome 66+).
 *   워크릿 코드는 별도 파일 없이 Blob URL 로 인라인 로드한다.
 *
 * Noise Gate 상세:
 *   ▸ 프리버퍼(Ring Buffer) — 임계값 이하일 때도 최근 PREBUFFER_CHUNKS
 *     개 청크를 유지. 임계값 돌파 순간 "이전 큐 + 현재 청크"를 묶어 전송
 *     → 말의 첫 자음(ㄱ, ㅅ 등)이 잘리는 Clipping 방지.
 *   ▸ 행오버(Hangover) — 임계값 아래로 내려가도 HANGOVER_CHUNKS 동안
 *     전송 유지 → 말끝/단어 사이 쉼에서 게이트가 덜컥 닫히는 것 방지.
 *
 * 사용 예
 *   const { start, stop } = useMicStream({
 *     onChunk: (int16) => sendBinary(int16.buffer),
 *   });
 * ────────────────────────────────────────────────────────────── */

const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024;         // ~64ms @16kHz (워크릿이 이 크기로 모아서 보냄)

// ---- Noise Gate 튜닝 대상 ----
const THRESHOLD_DB = -29;        // 게이트 여는 데시벨 (환경 소음에 맞춰 조절)
                                 //   조용한 방 바닥소음 ≈ -60 ~ -70dB
                                 //   보통 발화        ≈ -35 ~ -20dB
const PREBUFFER_CHUNKS = 3;      // 프리버퍼 크기 (~192ms) — 첫마디 잘림 방지
const HANGOVER_CHUNKS = 5;       // 임계값 밑으로 떨어진 후에도 전송 유지 (~320ms, 말끝 보존용)
                                 //   발화 커트는 EOS 무음 패딩이 담당 — 잘림 발생 시 6~7로 상향
// 게이트 닫힘 직후 밀어넣는 무음(0) 청크 수 (~768ms)
// backend VAD 의 발화종료 판정(END_SILENCE_FRAMES=30, 600ms)보다 길어야 함
const EOS_PADDING_CHUNKS = 12;

// 재사용하는 무음 청크 (전부 0 — webrtcvad 가 100% 무음으로 판정)
const SILENT_CHUNK = new Int16Array(CHUNK_SIZE);


/* ── AudioWorklet 코드 (오디오 스레드에서 실행) ──────────────
 * process() 는 128프레임씩 호출됨 — CHUNK_SIZE 만큼 모아서
 * 한 번에 postMessage (메시지 빈도 1/8로 감소).                  */
const WORKLET_CODE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(${CHUNK_SIZE});
    this._off = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const n = Math.min(ch.length - i, ${CHUNK_SIZE} - this._off);
      this._buf.set(ch.subarray(i, i + n), this._off);
      this._off += n;
      i += n;
      if (this._off === ${CHUNK_SIZE}) {
        // 복사본을 transfer 로 전달 (오디오 스레드 → 메인 스레드)
        const out = this._buf.slice();
        this.port.postMessage(out, [out.buffer]);
        this._off = 0;
      }
    }
    return true; // 노드 유지
  }
}
registerProcessor("mic-capture", MicCaptureProcessor);
`;

// Float32 [-1,1] → Int16 PCM
function floatTo16BitPCM(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

// 청크 RMS → dBFS (0dB = 최대 진폭, 무음 ≈ -Infinity)
function chunkDb(float32) {
    let sum = 0;
    for (let i = 0; i < float32.length; i++) {
        sum += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sum / float32.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

export function useMicStream({ onChunk } = {}) {
    const ctxRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);
    const workletRef = useRef(null);

    // Noise Gate 상태
    const preBufferRef = useRef([]);   // 임계값 이하 구간의 최근 청크 (Int16Array[])
    const hangoverRef = useRef(0);     // 남은 hangover 청크 수 (>0 이면 게이트 열림 유지)

    // onChunk 최신값 유지 (콜백 클로저 문제 방지)
    const onChunkRef = useRef(onChunk);
    useEffect(() => {
        onChunkRef.current = onChunk;
    }, [onChunk]);

    // 측정용 (튜닝 끝나면 제거) — 1초마다 max/avg dB 출력
    const statRef = useRef({ max: -Infinity, sum: 0, n: 0, t: Date.now() });

    /* 워크릿에서 넘어온 Float32 청크 → dB 판정 → Noise Gate */
    const handleWorkletChunk = useCallback((float32) => {
        const db = chunkDb(float32);
        const int16 = floatTo16BitPCM(float32);

        // 측정용 (튜닝 끝나면 제거)
        const s = statRef.current;
        s.max = Math.max(s.max, db);
        s.sum += db;
        s.n += 1;
        if (Date.now() - s.t > 1000) {
            console.log(
                `[mic] max ${s.max.toFixed(1)} dB | avg ${(s.sum / s.n).toFixed(1)} dB`
            );
            statRef.current = { max: -Infinity, sum: 0, n: 0, t: Date.now() };
        }

        if (db >= THRESHOLD_DB) {
            // ── 게이트 OPEN ──────────────────────────
            // 임계값 돌파 순간: 프리버퍼(직전 무음쪽 청크)부터 먼저 방출
            //   → 첫 자음 잘림 방지
            if (preBufferRef.current.length > 0) {
                for (const buffered of preBufferRef.current) {
                    onChunkRef.current?.(buffered);
                }
                preBufferRef.current = [];
            }
            onChunkRef.current?.(int16);
            hangoverRef.current = HANGOVER_CHUNKS; // hangover 리셋
        } else if (hangoverRef.current > 0) {
            // ── HANGOVER (게이트 서서히 닫힘) ────────
            onChunkRef.current?.(int16);
            hangoverRef.current -= 1;

            // hangover 소진 = 게이트가 닫히는 순간
            // → 무음(0) 패딩을 burst 로 밀어넣어 발화를 결정론적으로 커트
            //   (배경 소음과 무관하게 backend VAD 가 반드시 발화 종료 판정.
            //    burst 전송이라 체감 지연에는 영향 없음)
            if (hangoverRef.current === 0) {
                for (let i = 0; i < EOS_PADDING_CHUNKS; i++) {
                    onChunkRef.current?.(SILENT_CHUNK);
                }
            }
        } else {
            // ── 게이트 CLOSED ────────────────────────
            // 전송하지 않고 프리버퍼(링버퍼)만 갱신
            preBufferRef.current.push(int16);
            if (preBufferRef.current.length > PREBUFFER_CHUNKS) {
                preBufferRef.current.shift();
            }
        }
    }, []);

    const start = useCallback(async () => {
        if (ctxRef.current) return; // 이미 실행 중

        // 1) 마이크
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 2) AudioContext 16kHz (source 가 16kHz 로 자동 리샘플됨)
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        ctxRef.current = ctx;

        // 3) AudioWorklet 모듈 로드 (Blob URL 인라인 — 별도 파일 불필요)
        const blobUrl = URL.createObjectURL(
            new Blob([WORKLET_CODE], { type: "application/javascript" })
        );
        try {
            await ctx.audioWorklet.addModule(blobUrl);
        } finally {
            URL.revokeObjectURL(blobUrl);
        }

        // 4) 마이크 → 워크릿 연결
        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const worklet = new AudioWorkletNode(ctx, "mic-capture", {
            numberOfInputs: 1,
            numberOfOutputs: 0,   // 출력 불필요 (destination 연결 안 함)
            channelCount: 1,
        });
        workletRef.current = worklet;

        worklet.port.onmessage = (e) => handleWorkletChunk(e.data);

        source.connect(worklet);

        // 상태 초기화
        preBufferRef.current = [];
        hangoverRef.current = 0;
    }, [handleWorkletChunk]);

    const stop = useCallback(() => {
        if (workletRef.current) {
            workletRef.current.port.onmessage = null;
            workletRef.current.disconnect();
        }
        sourceRef.current?.disconnect();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        ctxRef.current?.close();

        workletRef.current = null;
        sourceRef.current = null;
        streamRef.current = null;
        ctxRef.current = null;

        preBufferRef.current = [];
        hangoverRef.current = 0;
    }, []);

    // 언마운트 시 정리
    useEffect(() => stop, [stop]);

    return { start, stop };
}

export default useMicStream;
