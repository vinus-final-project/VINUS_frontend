import { useCallback, useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * _request — REST hook 공통 실행기
 *
 * api/ 의 도메인 hook 들이 반복하던 try/catch/finally 보일러플레이트를
 * 한 곳으로 모은다. 각 hook 은 useApiRunner() 로 { error, setError,
 * isLoading, run } 을 받아 엔드포인트를 한 줄로 선언한다.
 *
 * 사용 예
 *   const { error, setError, isLoading, run } = useApiRunner();
 *
 *   const createOrder = (session_id, menu_id) =>
 *       run(() => api.post("/orders", { session_id, menu_id }),
 *           "메뉴 선택에 실패했습니다.");
 *
 * 반환 규약 (기존 hook 들과 동일)
 *   성공 → response.data          (SessionResponse 등)
 *   실패 → null  + error 상태에 메시지 세팅
 *
 *   axios 는 비 2xx 를 throw 하므로, throw 없이 도달한 응답은 모두 2xx.
 *   기존 코드의 `if (res.status === 200)` 분기는 사실상 항상 참이었고,
 *   204/201 등에서만 undefined 를 반환하는 비일관이 있었다 — 여기서
 *   2xx 를 일괄 성공 처리해 정리한다. (호출부는 모두 falsy 검사라 무영향)
 * ────────────────────────────────────────────────────────────── */

export const useApiRunner = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    /* request : () => Promise<AxiosResponse>  — 실제 호출을 감싼 thunk
     * failMessage : backend detail 이 없을 때 쓸 사용자 메시지            */
    const run = useCallback(async (request, failMessage) => {
        try {
            setIsLoading(true);
            const res = await request();
            return res?.data ?? null;
        } catch (e) {
            console.log(e);
            /* ⚠ data 에도 옵셔널 체이닝 필수.
             *   프록시/게이트웨이가 HTML 에러페이지(502 등)를 반환하면
             *   response 는 있지만 data 가 문자열/undefined 라, 예전 코드의
             *   `e.response?.data.detail` 은 catch 안에서 TypeError 를 던져
             *   return null 이 실행되지 않았다. */
            setError(e?.response?.data?.detail || failMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { error, setError, isLoading, run };
};

/* URL path segment 안전 삽입 (session_id 등) —
 * 기존 hook 들이 encodeURIComponent 적용에 일관성이 없어 헬퍼로 통일 */
export const seg = (v) => encodeURIComponent(String(v ?? ""));

export default useApiRunner;
