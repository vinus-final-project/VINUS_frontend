import { registerPlugin, Capacitor } from "@capacitor/core";

/* ──────────────────────────────────────────────────────────────
 * nativeMic — 네이티브 마이크 캡처 래퍼 (Android NativeMicPlugin)
 *
 *   APK 에서만 사용. AudioRecord(VOICE_COMMUNICATION) + 하드웨어 AEC/NS/AGC
 *   로 캡처한 16kHz mono Int16 PCM 을 "micData" 이벤트(base64)로 받아
 *   Int16Array 로 디코드해 onChunk 콜백에 전달.
 *
 *   자기 TTS 에코 제거·잡음 억제는 네이티브가 처리 → JS 는 그대로 WS 전송만.
 *   발화 구간 분리는 백엔드 VadSegmenter 담당.
 * ────────────────────────────────────────────────────────────── */

const NativeMic = registerPlugin("NativeMic");

export function isNativeMic() {
    return Capacitor.isNativePlatform();
}

/* 캡처 시작 — onChunk(Int16Array) 로 PCM 청크 전달. listener handle 반환. */
export async function startNativeMic(onChunk) {
    const handle = await NativeMic.addListener("micData", (ev) => {
        const bin = atob(ev.pcm);              // base64 → 바이너리 문자열
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        // Int16 PCM LE → Int16Array (ARM/x86 = little-endian)
        onChunk?.(new Int16Array(bytes.buffer));
    });
    await NativeMic.start();
    return handle;
}

/* 캡처 정지 — 네이티브 stop + listener 해제 */
export async function stopNativeMic(handle) {
    try { await NativeMic.stop(); } catch { /* ignore */ }
    try { await handle?.remove?.(); } catch { /* ignore */ }
}

export default NativeMic;
