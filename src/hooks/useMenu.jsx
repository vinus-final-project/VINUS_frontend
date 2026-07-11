import { useState } from "react";
import api from "../utils/api";

/* ──────────────────────────────────────────────────────────────
 * useMenu — 메뉴 / 카테고리 도메인 API hook
 *
 * 응답 스키마 (backend/app/db/scheme/*.py 기준)
 *   GET /categories          → { categories: [{ c_id, c_name }] }
 *   GET /menus?c_id={int}    → { menus: [{ m_id, c_id, m_name, m_price }] }
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

const useMenu = () => {
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 카테고리 목록 조회
    const getCategories = async () => {
        try {
            setIsLoading(true);
            const response = await api.get("/categories");
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "카테고리 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 카테고리별 메뉴 목록 조회
    const getMenus = async (c_id) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/menus?c_id=${c_id}`);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "메뉴 목록 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 부트스트랩: 카테고리 + 전체 메뉴 일괄 조회 (GET /menus/all)
    //   초기 렌더 6회 호출(카테고리 1 + 카테고리별 5)을 1회로 축소.
    //   캐시가 있으면 서버 호출 없이 즉시 반환.
    const getAllMenus = async () => {
        if (menuBootstrapCache) return menuBootstrapCache;
        try {
            setIsLoading(true);
            const response = await api.get("/menus/all");
            if (response.status === 200) {
                menuBootstrapCache = response.data; // { categories, menus }
                return menuBootstrapCache;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "메뉴 일괄 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 메뉴 상세 조회
    const getMenuDetail = async (m_id) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/menus/${m_id}`);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.log(error);
            setError(error.response?.data.detail || "메뉴 상세 조회에 실패했습니다.");
            return null;
        } finally {
            setIsLoading(false);
        }
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
