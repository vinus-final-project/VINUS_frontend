import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useSession from "../hooks/useSession";
import useTts from "../hooks/useTts";
import { resolvePageGuideText } from "../constants";
import { ttsStartedMic, ttsEndedMic, isPaymentLockedMic } from "../utils/micGate";

/* ──────────────────────────────────────────────────────────────
 * PageGuide — 페이지 입장 음성 안내 (전역 상주, 렌더 없음)
 *
 * TtsPlayer(SessionResponse.message 재생)와 역할 분담:
 *   ① 백엔드 message 가 실려 온 전이 → TtsPlayer 가 읽음 (에코백/안내)
 *   ② message 없는 전이(터치 이동 등) → 여기서 페이지 기본 안내 재생
 *
 * 우선순위 판정: "직전 라우트 변경 이후 responseSeq 가 전진했고
 * 그 응답에 message 가 있으면" 이 전이는 백엔드 안내가 담당 → skip.
 * (음성 이동: applySessionResponse → SessionRouter navigate 순서라
 *  경로가 바뀐 시점엔 seq 전진 + message 세팅이 끝나 있다.
 *  추후 팀원이 에코백 message 를 채우면 자동으로 그쪽이 우선된다.)
 *
 * 재생하지 않는 경우:
 *   - 경로가 실제로 바뀌지 않은 재렌더
 *   - 안내 문구가 정의되지 않은 페이지 (start / pay / end)
 *   - 결제 잠금 중 (pay — micGate)
 *   - 백엔드 message 가 이 전이를 담당할 때 (위 규칙)
 *
 * barge-in: TtsPlayer 와 동일하게 onStart/onEnd 를 micGate 에 연동 —
 * 안내 재생 중 사용자 발화 감지 시 즉시 끊긴다.
 * ────────────────────────────────────────────────────────────── */
export default function PageGuide() {
    const { pathname } = useLocation();
    const { message, responseSeq } = useSession();
    const { speak } = useTts();

    const prevPathRef = useRef(pathname);       // 직전 경로
    const seqAtLastRouteRef = useRef(0);        // 직전 라우트 변경 시점의 seq

    useEffect(() => {
        // 경로가 실제로 바뀔 때만 동작 (seq 기록도 이때만 갱신 —
        // 매 응답마다 갱신하면 "이 전이에 응답이 실렸는지" 판정이 깨짐)
        if (pathname === prevPathRef.current) return;

        const seqAtLastRoute = seqAtLastRouteRef.current;
        prevPathRef.current = pathname;
        seqAtLastRouteRef.current = responseSeq;

        // 결제 잠금 중(pay 페이지) — 안내 금지
        if (isPaymentLockedMic() || pathname.startsWith("/pay")) return;

        // 이 전이에 백엔드 message 가 실려 왔으면 그쪽(TtsPlayer)이 우선
        if (responseSeq !== seqAtLastRoute && message && message.trim()) return;

        const text = resolvePageGuideText(pathname);
        if (!text) return;

        speak(text, { onStart: ttsStartedMic, onEnd: ttsEndedMic });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, responseSeq, message]);

    return null;
}
