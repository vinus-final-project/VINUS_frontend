/* ──────────────────────────────────────────────────────────────
 * constants.jsx — 앱 전체에서 쓰는 매직넘버 모음.
 * 값을 바꿀 때 한 곳만 수정하면 됨.
 * ────────────────────────────────────────────────────────────── */

/* 주문 흐름 페이지(order / orderDetail / cart) 의 자동 종료 타이머 (초) */
export const MAIN_TIME_LIMIT_SEC = 300;

/* receipt 모달이 떠 있을 때 자동으로 end 페이지로 이동하기까지 (ms) */
export const RECEIPT_AUTO_END_MS = 3000;

/* start: 스플래시에서 메인 진입까지 누르고 있어야 하는 시간 (ms) */
export const START_HOLD_MS = 2000;

/* receipt: 화면 아무 곳이나 눌러 영수증 인쇄를 트리거하는 시간 (ms) */
export const RECEIPT_HOLD_MS = 2000;

/* hold 중 허용하는 손가락 이동 반경 (px, viewport 기준).
 *   시각장애인 사용자는 화면을 더듬으며 누르기 때문에 손가락이 크게 흔들린다.
 *   Infinity = 이동 거리로는 취소하지 않음 — 화면 어디로 끌고 가도 hold 유지.
 *   취소는 오직 "손을 뗐을 때(pointerup)" 와 "시스템이 포인터를 회수했을 때
 *   (pointercancel — 네이티브 스크롤 시작 등)" 뿐이다.
 *
 *   ※ 목록 스크롤과 hold 가 충돌하면 여기에 숫자(예: 80)를 넣어 제한할 것. */
export const HOLD_MOVE_TOLERANCE_PX = Infinity;

/* receipt: 아무 조작 없이 대기 시 자동으로 "영수증 안 받기" 처리 (ms).
 *   음성 UI 사용자 대응 — 응답이 없으면 넘어가도록. */
export const RECEIPT_AUTO_SKIP_MS = 12000;

/* end: 결제 완료 후 자동으로 처음으로 돌아가는 시간 (ms). */
export const AUTO_HOME_MS = 8000;

/* cart / end: ▲▼ 한 번에 스크롤되는 양 (px, --u 곱은 추후 필요 시) */
export const LIST_SCROLL_STEP = 230;

/* 매장 정보 (임시 상수 — 추후 backend 세팅 API 로 교체 예정) */
export const STORE_NAME = "VINUS 종로점";

/* receipt 임시 주문 번호 — 결제 응답(od_no) 유실 시 fallback 표시용 */
export const ORDER_NUMBER = 271;

/* ── 페이지 입장 음성 안내 (PageGuide) ─────────────────────────
 * 터치 이동 등 "백엔드 message 없는" 화면 전이에서만 재생된다.
 * 음성 명령/터치 조작에 백엔드 message(에코백)가 실려 오면 그쪽이 우선 —
 * 우선순위 규칙은 components/PageGuide.jsx 참고.
 * 키는 라우트 경로. 메뉴 상세는 "/menu" prefix 매칭.
 * 없는 페이지(start, pay, end)는 안내 없음:
 *   start — 대기 화면, pay — 결제 잠금(micGate), end — PAYMENT_SUCCESS
 *   message 가 이미 안내.                                             */
export const PAGE_GUIDE_TEXT = {
    "/main": "매장에서 드시면 매장, 가져가시면 포장을 선택해주세요.",
    "/order": "카테고리는 커피, 음료, 차, 요거트, 디저트, 베이커리가 있습니다. 카테고리 또는 주문하실 메뉴를 선택해주세요. 추천을 원하신다면 추천이라고 말씀해주세요. 알러지가 있으시다면 말씀해주세요.",
    "/menu": "옵션을 선택하시고 주문 완료라고 말씀해주세요.",
    "/cart": "주문 내역을 확인하시고 결제하시려면 결제할게요라고 말씀해주세요.",
    "/payment": "결제 수단을 선택해주세요. 결제 수단은 카드가 있습니다.",
    // "/receipt" 는 receipt 페이지가 자체 TTS 로 대기번호/안내를 처리하므로 제외.
    // "/end"     도 end 페이지가 주문 내역을 직접 읽으므로 제외.
};

/* 경로 → 안내 문구 (없으면 null). 메뉴 상세(/menu/3 등)는 prefix 매칭 */
export const resolvePageGuideText = (pathname) => {
    if (PAGE_GUIDE_TEXT[pathname]) return PAGE_GUIDE_TEXT[pathname];
    if (pathname.startsWith("/menu/")) return PAGE_GUIDE_TEXT["/menu"];
    return null;
};