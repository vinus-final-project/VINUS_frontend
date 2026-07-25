import api from "../utils/api";
import { useApiRunner } from "./_request";

/* ──────────────────────────────────────────────────────────────
 * useMenu — 메뉴 / 카테고리 도메인 API hook
 *
 * 응답 스키마 (backend/app/db/scheme/*.py 기준)
 *   GET /categories          → { categories: [{ c_id, c_name }] }
 *   GET /menus?c_id={int}    → { menus: [{ m_id, c_id, m_name, m_price }] }
 *   GET /menus/all           → { categories: [...], menus: [...] }  (부트스트랩)
 *   GET /menus/{m_id}        → {
 *       m_id, m_name, m_price, m_description?,
 *       allergies:     [{ a_id, a_name }],
 *       ingredients:   [{ i_id, i_name }],
 *       option_groups: [{ og_id, og_name, og_required, og_min, og_max,
 *                         options: [{ op_id, op_name, op_price, og_id }] }],
 *   }
 *
 * 사용 예:
 *   const { getCategories, getMenus, getMenuDetail, error } = useMenu();
 *   const { categories } = await getCategories();
 *   const { menus }      = await getMenus(c_id);
 *   const detail         = await getMenuDetail(m_id);
 * ────────────────────────────────────────────────────────────── */

/* ── 메뉴 부트스트랩 캐시 (모듈 레벨) ────────────────────────
 * 키오스크 메뉴는 운영 중 불변 → 앱 기동 후 첫 호출만 서버에 가고
 * 이후 재진입은 메모리에서 즉시 반환 (빈 그리드 깜빡임 제거).
 * 메뉴 갱신/품절 기능이 생기면 이 캐시에 무효화 로직을 붙일 것.        */
let menuBootstrapCache = null;

/* 캐시 동기 조회 — 페이지가 초기 state 시드용으로 사용 */
export const getMenuBootstrapCache = () => menuBootstrapCache;

/* ── 수량 단위 조회 (디저트 "개" / 음료 "잔") ─────────────────
 * 부트스트랩 캐시의 c_name 기준. 캐시 미적재/미발견 시 "개" 폴백.
 * (백엔드 에코백의 단위 규칙과 동일 — ruleEngine 메뉴 메타 캐시)      */
export const getMenuUnit = (menuId) => {
    if (!menuBootstrapCache || menuId == null) return "개";
    const menu = (menuBootstrapCache.menus ?? []).find((m) => m.m_id === menuId);
    if (!menu) return "개";
    const cat = (menuBootstrapCache.categories ?? []).find(
        (c) => c.c_id === menu.c_id
    );
    return cat && cat.c_name.includes("디저트") ? "개" : "잔";
};

const useMenu = () => {
    const { error, setError, isLoading, run } = useApiRunner();

    // 카테고리 목록 조회
    const getCategories = () =>
        run(() => api.get("/categories"), "카테고리 조회에 실패했습니다.");

    // 카테고리별 메뉴 목록 조회
    const getMenus = (c_id) =>
        run(
            () => api.get(`/menus?c_id=${encodeURIComponent(c_id)}`),
            "메뉴 목록 조회에 실패했습니다."
        );

    // 메뉴 상세 조회
    const getMenuDetail = (m_id) =>
        run(() => api.get(`/menus/${m_id}`), "메뉴 상세 조회에 실패했습니다.");

    /* 부트스트랩: 카테고리 + 전체 메뉴 일괄 조회 (GET /menus/all)
     *   초기 렌더 6회 호출(카테고리 1 + 카테고리별 5)을 1회로 축소.
     *   캐시가 있으면 서버 호출 없이 즉시 반환.
     *   ※ run() 을 거치되 성공 시에만 캐시에 적재 (실패는 null)          */
    const getAllMenus = async () => {
        if (menuBootstrapCache) return menuBootstrapCache;
        const data = await run(
            () => api.get("/menus/all"),
            "메뉴 일괄 조회에 실패했습니다."
        );
        if (data) menuBootstrapCache = data; // { categories, menus }
        return data;
    };

    return {
        error,
        setError,
        isLoading,
        getCategories,
        getMenus,
        getAllMenus,
        getMenuDetail,
    };
};

export default useMenu;
