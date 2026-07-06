import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

/* ──────────────────────────────────────────────────────────────
 * toss.js — 토스페이먼츠 SDK 초기화 헬퍼
 *
 * 사용:
 *   import { getTossPayments } from "../utils/toss";
 *   const toss = await getTossPayments();
 *   await toss.requestPayment("CARD", { amount, orderId, ... });
 *
 * SDK 인스턴스는 한 번만 로드해서 재사용한다.
 * 클라이언트 키(test_ck_... / live_ck_...)는 .env 의 VITE_TOSS_CLIENT_KEY.
 *   ※ 이 키는 사용자 화면에 노출되어도 안전한 공개 키다.
 *     시크릿 키(test_sk_.../live_sk_...)는 backend .env 에만 두어야 한다.
 * ────────────────────────────────────────────────────────────── */

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY;

let tossPromise = null;

/**
 * 토스페이먼츠 인스턴스를 반환한다. 최초 호출 시 SDK 를 로드하고,
 * 이후 호출에는 캐시된 promise 를 재사용한다.
 */
export const getTossPayments = () => {
    if (!CLIENT_KEY) {
        return Promise.reject(
            new Error("VITE_TOSS_CLIENT_KEY 가 설정되지 않았습니다.")
        );
    }
    if (!tossPromise) {
        tossPromise = loadTossPayments(CLIENT_KEY);
    }
    return tossPromise;
};

export default getTossPayments;
