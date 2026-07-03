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
        getMenuDetail,
    };
};

export default useMenu;
