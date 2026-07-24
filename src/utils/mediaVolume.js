import { registerPlugin } from "@capacitor/core";

/* ──────────────────────────────────────────────────────────────
 * mediaVolume — TTS duck 을 위한 시스템 미디어 볼륨 조절 wrapper
 *
 *   ▸ APK  : 커스텀 Capacitor plugin (MediaVolumePlugin.java)
 *             AudioManager.setStreamVolume(STREAM_MUSIC, curr/2)
 *   ▸ Web  : SpeechSynthesis.pause/resume 로 대체
 *             (Web Speech API 는 재생 중 볼륨 조절 표준 미지원 —
 *              완전 pause/resume 로 근사)
 *
 * 사용:
 *   TtsPlayer 가 mount 시 micGate.setTtsDuckerMic({duck, unduck}) 로 등록.
 *   useMicStream 이 발화 감지 시 duckMedia(), hangover 만료 시 unduckMedia().
 *
 * duck 대상은 TtsPlayer(SessionResponse.message) 뿐 —
 * PageGuide/receipt/end/receiptModal 등 페이지 안내는 콜백 미등록으로
 * isTtsActiveMic() 이 false 유지 → duck 발동 안 함.
 * ────────────────────────────────────────────────────────────── */

const MediaVolume = registerPlugin("MediaVolume", {
    web: () => ({
        async duck() {
            try {
                window.speechSynthesis?.pause();
            } catch {
                /* ignore */
            }
        },
        async unduck() {
            try {
                window.speechSynthesis?.resume();
            } catch {
                /* ignore */
            }
        },
    }),
});

/** 시스템 미디어 볼륨을 50% 로 감소 (실패 시 조용히 무시) */
export async function duckMedia() {
    try {
        await MediaVolume.duck();
    } catch (e) {
        console.warn("[mediaVolume] duck 실패(무시):", e?.message ?? e);
    }
}

/** 시스템 미디어 볼륨을 원래 값으로 복원 (실패 시 조용히 무시) */
export async function unduckMedia() {
    try {
        await MediaVolume.unduck();
    } catch (e) {
        console.warn("[mediaVolume] unduck 실패(무시):", e?.message ?? e);
    }
}

export default MediaVolume;
