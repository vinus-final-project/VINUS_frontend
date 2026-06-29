/* ──────────────────────────────────────────────────────────────
 * sampleData.js — 백엔드 연동 전까지 사용하는 mock 데이터.
 *
 * 실제 연결 시 이 파일의 export 를 API/Context 로 교체하면 됨.
 * 각 페이지는 이 파일에서만 가져오므로 한 곳만 바꾸면 전체 반영.
 * ────────────────────────────────────────────────────────────── */

/* 매장 정보 */
export const STORE_NAME = "가맹점명";
export const ORDER_NUMBER = 271;

/* 카테고리 */
export const CATEGORIES = ["전체", "커피", "논커피", "차", "디저트"];

/* 메뉴 전체 목록 */
export const MENUS = [
  { id: 1,  name: "솔티드 쿨 리치",            price: 2500,  category: "논커피", desc: "짭쪼름하고 리치 향이 많이 나는 이온음료" },
  { id: 2,  name: "오리지널 블랜드 커피(아이스)", price: 4000,  category: "커피" },
  { id: 3,  name: "블랙앤거스 스테이크 피자(R)",  price: 27000, category: "디저트" },
  { id: 4,  name: "아메리카노(핫)",              price: 3000,  category: "커피" },
  { id: 5,  name: "카페라떼",                  price: 4500,  category: "커피" },
  { id: 6,  name: "딸기 스무디",                price: 5500,  category: "논커피" },
  { id: 7,  name: "녹차",                     price: 3500,  category: "차" },
  { id: 8,  name: "초코 케이크",                price: 6000,  category: "디저트" },
  { id: 9,  name: "치즈 케이크",                price: 6500,  category: "디저트" },
  { id: 10, name: "바닐라 라떼",                price: 5000,  category: "커피" },
  { id: 11, name: "유자차",                    price: 4000,  category: "차" },
  { id: 12, name: "고구마 라떼",                price: 5500,  category: "논커피" },
];

/* 단건 조회 */
export const getMenuById = (id) =>
  MENUS.find((m) => String(m.id) === String(id));

/* 메뉴 옵션 (orderDetail) */
export const MENU_OPTIONS = {
  cups: ["일회용", "개인 텀블러"],
  sugarPumps: [1, 2],            // 설탕시럽 펌프 수
  strengths: ["연하게", "진하게"],   // 농도
  paid: [
    { id: "vanilla",  name: "바닐라시럽",      price: 500 },
    { id: "shot",     name: "에스프레소 샷추가", price: 500 },
    { id: "pearl",    name: "펄추가",         price: 700 },
    { id: "javachip", name: "자바칩",         price: 600 },
    { id: "whip",     name: "휘핑크림",        price: 500 },
  ],
};

/* 장바구니 mock (cart) */
export const CART_ITEMS = [
  { id: 1, name: "솔티드 쿨 리치", price: 2500 },
  { id: 2, name: "솔티드 쿨 리치", price: 2500 },
  { id: 3, name: "솔티드 쿨 리치", price: 2500 },
  { id: 4, name: "솔티드 쿨 리치", price: 2500 },
  { id: 5, name: "솔티드 쿨 리치", price: 2500 },
  { id: 6, name: "솔티드 쿨 리치", price: 2500 },
];

/* 결제 내역 mock (end) */
export const ORDER_ITEMS = [
  { id: 1, name: "솔티드 쿨 리치", count: 4, price: 2500 },
  { id: 2, name: "솔티드 쿨 리치", count: 4, price: 2500 },
  { id: 3, name: "솔티드 쿨 리치", count: 4, price: 2500 },
  { id: 4, name: "솔티드 쿨 리치", count: 4, price: 2500 },
  { id: 5, name: "솔티드 쿨 리치", count: 4, price: 2500 },
];
