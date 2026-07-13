/* ──────────────────────────────────────────────────────────────
 * constants.jsx — 앱 전체에서 쓰는 매직넘버 모음.
 * 값을 바꿀 때 한 곳만 수정하면 됨.
 * ────────────────────────────────────────────────────────────── */

/* 전체 메뉴 페이지: 한 화면에 보일 메뉴 개수 (3 x 3) */
export const ORDER_PAGE_SIZE = 9;

/* 주문 흐름 페이지(order / orderDetail / cart) 의 자동 종료 타이머 (초) */
export const MAIN_TIME_LIMIT_SEC = 180;

/* 결제 흐름 페이지(payment / pay) 의 자동 종료 타이머 (초) */
export const PAYMENT_TIME_LIMIT_SEC = 30;

/* receipt 모달이 떠 있을 때 자동으로 end 페이지로 이동하기까지 (ms) */
export const RECEIPT_AUTO_END_MS = 3000;

/* start: 스플래시에서 메인 진입까지 누르고 있어야 하는 시간 (ms) */
export const START_HOLD_MS = 3000;

/* end: 결제 완료 후 자동으로 처음으로 돌아가는 시간 (초) */
export const AUTO_HOME_SEC = 5;

/* cart / end: ▲▼ 한 번에 스크롤되는 양 (px, --u 곱은 추후 필요 시) */
export const LIST_SCROLL_STEP = 230;

/* 매장 정보 (임시 상수 — 추후 backend 세팅 API 로 교체 예정) */
export const STORE_NAME = "가맹점명";

/* receipt 임시 주문 번호 — 결제 응답(od_no) 유실 시 fallback 표시용 */
export const ORDER_NUMBER = 271;

/*  로컬 프린트 에이전트 주소 (print_agent/main.py — 키오스크 PC 상주).
 *  포트 변경 시 에이전트 .env 의 AGENT_PORT 와 함께 맞출 것.               */
export const PRINT_AGENT_URL = "http://127.0.0.1:8300";

/*  주문번호(od_no) sessionStorage 백업 키.
 *  pay 페이지가 backend POST /payments/confirm 응답의 od_no 를 저장하고,
 *  receipt 모달 / end 페이지가 읽어 표시한다.
 *  sessionStorage 이유: Toss 리다이렉트(full reload) 생존 + 탭 종료 시
 *  자동 삭제 → 다음 손님에게 이전 주문번호 노출 방지.                     */
export const SS_OD_NO_KEY = "vinus.order.od_no";

/*  SS 에 백업된 주문번호 읽기 (없거나 파싱 실패 시 null) */
export const readOrderNo = () => {
    try {
        const n = Number(sessionStorage.getItem(SS_OD_NO_KEY));
        return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
};
