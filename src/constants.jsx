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
