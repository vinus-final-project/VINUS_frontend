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

/* ── 페이지 입장 음성 안내 (PageGuide) ─────────────────────────
 * 터치 이동 등 "백엔드 message 없는" 화면 전이에서만 재생된다.
 * 음성 명령으로 이동한 경우 백엔드 message(에코백/안내)가 우선 —
 * 우선순위 규칙은 components/PageGuide.jsx 참고.
 * 키는 라우트 경로. 메뉴 상세는 "/menu" prefix 매칭.
 * 없는 페이지(start, pay, end)는 안내 없음:
 *   start — 대기 화면, pay — 결제 잠금(micGate), end — PAYMENT_SUCCESS
 *   message 가 이미 안내.                                             */
export const PAGE_GUIDE_TEXT = {
    "/main": "매장에서 드시면 매장, 가져가시면 포장을 선택해주세요.",
    "/order": "주문하실 메뉴를 말씀하시거나 화면에서 선택해주세요.",
    "/menu": "옵션을 선택해주세요. 다 고르셨으면 주문 완료라고 말씀해주세요.",
    "/cart": "주문 내역을 확인해주세요. 결제하시려면 결제할게요라고 말씀해주세요.",
    "/payment": "결제 수단을 선택해주세요.",
    "/receipt": "영수증이 필요하시면 영수증 받기 버튼을 눌러주세요.",
};

/* 경로 → 안내 문구 (없으면 null). 메뉴 상세(/menu/3 등)는 prefix 매칭 */
export const resolvePageGuideText = (pathname) => {
    if (PAGE_GUIDE_TEXT[pathname]) return PAGE_GUIDE_TEXT[pathname];
    if (pathname.startsWith("/menu/")) return PAGE_GUIDE_TEXT["/menu"];
    return null;
};
