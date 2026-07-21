import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useSession from "../hooks/useSession";
import useTts from "../hooks/useTts";
import { getMenuBootstrapCache } from "../hooks/useMenu";
import { resolvePageGuideText } from "../constants";
import { ttsStartedMic, ttsEndedMic, isPaymentLockedMic } from "../utils/micGate";

/* 세션당 1회 — 주문 화면 첫 진입에만 카테고리 목록을 포함해 안내.
 * (카트 갔다 돌아올 때마다 전체 카테고리를 읊으면 소음)
 * session_id 가 바뀌면(다음 손님) 리셋. 모듈 스코프 — 리로드 시 초기화. */
let categoriesSpokenForSession = null;

/* /order 첫 진입용 확장 안내 — 부트스트랩 캐시에서 카테고리 동적 조립.
 * 캐시 미적재(앱 첫 부팅 직후)면 null 반환 → 기존 정적 문구 폴백. */
const buildOrderEntryGuide = () => {
    const cache = getMenuBootstrapCache();
    if (!cache?.categories?.length) return null;
    const names = cache.categories
        .map((c) => c.c_name.replace(/\//g, ", "))
        .join(", ");
    return (
        `${names} 종류가 있어요. 주문하실 메뉴를 말씀하시거나, ` +
        `커피 뭐 있어처럼 종류를 물어보세요.`
    );
};

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
 *  컨트롤러 에코백 message 도 같은 규칙으로 자동 우선된다.)
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
    const { message, responseSeq, session_id } = useSession();
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

        let text = resolvePageGuideText(pathname);
        if (!text) return;

        /* 주문 화면 첫 진입(손님당 1회) — 카테고리 목록 포함 확장 안내.
         * 재진입/캐시 미적재 시엔 기존 정적 문구 그대로.
         * ⚠ 첫 진입 시점엔 세션 생성 전이라 session_id 가 null —
         *   "presession" 키로 기록해두고, 세션이 생긴 뒤 재진입하면
         *   그 기록을 현재 세션 것으로 승계한다 (중복 낭독 방지).        */
        if (pathname === "/order") {
            const key = session_id ?? "presession";
            if (categoriesSpokenForSession === "presession" && session_id) {
                categoriesSpokenForSession = session_id; // 승계 — 이미 들은 손님
            } else if (categoriesSpokenForSession !== key) {
                const extended = buildOrderEntryGuide();
                if (extended) {
                    text = extended;
                    categoriesSpokenForSession = key;
                }
            }
        }

        speak(text, { onStart: ttsStartedMic, onEnd: ttsEndedMic });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, responseSeq, message]);

    return null;
}
