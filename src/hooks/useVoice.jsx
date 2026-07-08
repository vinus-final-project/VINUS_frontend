import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * useVoice — 음성(TTS) 도메인 API hook
 *
 * backend/app/routers/voice.py 기준.
 *
 * Endpoints
 *   GET /voices/{v_code}   보이스 코드로 음성 데이터(TTS) 조회
 *
 * 사용 예
 *   const { getVoice } = useVoice();
 *   const voice = await getVoice("welcome_1");
 *   // voice: VoiceRead — { v_code, ... 파일 URL 등 }
 *
 * ※ 지금은 스켈레톤. TTS 재생 흐름이 확정되면 여기서 데이터 fetch 후
 *   HTMLAudio / WebAudio 로 재생하도록 확장한다.
 * ────────────────────────────────────────────────────────────── */

const useVoice = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 보이스 코드로 음성 데이터 조회 — GET /voices/{v_code}
    const getVoice = async (v_code) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/voices/${encodeURIComponent(v_code)}`);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "음성 데이터 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        error,
        setError,
        isLoading,
        getVoice,
    };
};

export default useVoice;
