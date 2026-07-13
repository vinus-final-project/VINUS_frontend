import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

/* ──────────────────────────────────────────────────────────────
 * useTts — 플랫폼 하이브리드 TTS hook
 *
 *   ▸ APK(Capacitor 네이티브) : @capacitor-community/text-to-speech
 *       기기 TTS 엔진(구글 TTS 등) 직접 호출 — WebView speechSynthesis
 *       미지원/불안정 문제 회피
 *   ▸ PC 웹(dev)              : Web Speech API(크롬 내장 TTS)
 *       설치 없이 바로 테스트
 *
 * 분기 기준: Capacitor.isNativePlatform()
 *   (웹 빌드에서는 false — @capacitor/core 만으로 판정 가능)
 *
 * 사용 예
 *   const { speak, stop } = useTts();
 *   speak("장바구니에 담았어요.", {
 *     onStart: () => ...,   // 재생 시작 (barge-in 모드 진입 등)
 *     onEnd:   () => ...,   // 재생 종료/중단/실패 (모드 해제 등)
 *   });
 *   stop(); // 재생 중단 (barge-in)
 *
 * 보장:
 *   - speak() 는 이전 발화를 자동 취소하고 최신 문구만 재생
 *   - onEnd 는 정상 종료·취소·오류 모든 경로에서 호출
 *   - 새 speak 가 이전 발화를 교체한 경우, 이전 발화의 onEnd 는
 *     무시된다 (세대 카운터) — 늦게 도착한 이전 종료 이벤트가
 *     현재 재생의 barge-in 모드를 풀어버리는 레이스 방지
 * ────────────────────────────────────────────────────────────── */

/* ── 웹: 한국어 보이스 선택 (모듈 스코프 1회 준비) ──────────
 * getVoices() 는 브라우저에 따라 비동기 로드라 처음엔 빈 배열일 수
 * 있다 → voiceschanged 이벤트에서 재선택.                          */
let koVoice = null;
const pickKoVoice = () => {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    koVoice =
        voices.find((v) => v.lang === "ko-KR") ||
        voices.find((v) => (v.lang || "").startsWith("ko")) ||
        null;
};
if (typeof window !== "undefined" && window.speechSynthesis) {
    pickKoVoice();
    window.speechSynthesis.addEventListener?.("voiceschanged", pickKoVoice);
}

const useTts = () => {
    const [error, setError] = useState("");
    const [isSpeaking, setIsSpeaking] = useState(false);

    /* 세대 카운터 — speak 호출마다 +1.
     * 이전 발화의 종료 콜백은 세대가 다르면 무시 (레이스 방지) */
    const genRef = useRef(0);

    // ── APK: 네이티브 TTS 엔진 ──────────────────────────────
    const speakNative = async (text, gen, onStart, onEnd) => {
        const finish = () => {
            if (genRef.current !== gen) return; // 이미 새 발화로 교체됨
            setIsSpeaking(false);
            onEnd?.();
        };
        try {
            await TextToSpeech.stop(); // 이전 안내 중단 (최신 우선)
            if (genRef.current !== gen) return; // stop 사이 새 speak 발생
            setIsSpeaking(true);
            onStart?.();
            // speak Promise 는 "재생이 끝나는 시점"에 resolve,
            // stop() 으로 끊기면 reject → 어느 쪽이든 finish
            await TextToSpeech.speak({
                text,
                lang: "ko-KR",
                rate: 1.0,   // 재생 속도 (시각장애인 사용자 대상 튜닝 지점)
                pitch: 1.0,
                volume: 1.0,
            });
            finish();
        } catch {
            finish(); // 중단/오류 — 부가 기능이므로 조용히 정리만
        }
    };

    // ── PC 웹: Web Speech API (크롬 내장 TTS) ────────────────
    const speakWeb = (text, gen, onStart, onEnd) => {
        const synth = window.speechSynthesis;
        if (!synth) {
            console.warn("[useTts] speechSynthesis 미지원 브라우저");
            return;
        }

        synth.cancel(); // 이전 안내 중단 (최신 우선)

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "ko-KR";
        if (koVoice) utter.voice = koVoice;
        utter.rate = 1.0;
        utter.pitch = 1.0;

        /* onEnd 1회 보장 — cancel() 시 브라우저에 따라 onend 대신
         * onerror(canceled/interrupted)가 오므로 양쪽 다 잡는다 */
        let ended = false;
        const finish = () => {
            if (ended || genRef.current !== gen) return;
            ended = true;
            setIsSpeaking(false);
            onEnd?.();
        };

        utter.onstart = () => {
            if (genRef.current !== gen) return;
            setIsSpeaking(true);
            onStart?.();
        };
        utter.onend = finish;
        utter.onerror = (e) => {
            if (e.error !== "canceled" && e.error !== "interrupted") {
                console.warn("[useTts] 합성 오류:", e.error);
            }
            finish();
        };

        synth.speak(utter);
    };

    // ── 공용 진입점 ──────────────────────────────────────────
    const speak = useCallback((text, { onStart, onEnd } = {}) => {
        if (!text || !text.trim()) return false;
        const gen = ++genRef.current;

        try {
            if (Capacitor.isNativePlatform()) {
                speakNative(text.trim(), gen, onStart, onEnd); // fire-and-forget
            } else {
                speakWeb(text.trim(), gen, onStart, onEnd);
            }
            return true;
        } catch (err) {
            console.warn("[useTts] speak 실패:", err);
            setError(err.message || "음성 합성에 실패했습니다.");
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 재생 중단 (barge-in / 페이지 정리용)
    const stop = useCallback(() => {
        try {
            if (Capacitor.isNativePlatform()) {
                TextToSpeech.stop(); // pending speak Promise 가 reject → onEnd
            } else {
                window.speechSynthesis?.cancel();
            }
        } catch {
            /* ignore */
        }
    }, []);

    return {
        error,
        setError,
        isSpeaking,
        speak,
        stop,
    };
};

export default useTts;
