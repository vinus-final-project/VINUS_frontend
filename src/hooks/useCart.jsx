import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useSession from "./useSession";
import useCartApi from "../api/useCartApi";

/* ──────────────────────────────────────────────────────────────
 * useCart — 장바구니 selector + 마지막 주문 스냅샷
 *
 *  ▸ items / totalPrice / totalCount 는 **useSession.cart** (backend
 *    SessionResponse.cart) 의 파생값. 로컬 저장소 없음.
 *  ▸ 변경 함수(changeQuantity/removeItem/clearCart)는 backend REST
 *    (/sessions/{sid}/cart/*) 를 호출하고 응답 SessionResponse 를 세션에 반영.
 *  ▸ 결제 완료 후 end 페이지에서 표시할 lastOrder 스냅샷만 로컬에서 관리.
 *    (backend 는 결제 성공 시 cart 를 비우므로 프론트가 스냅샷을 붙잡아야 함)
 *
 * Backend CartItem 어댑터
 *   backend      | 프론트 표준
 *   -------------+------------
 *   cart_item_id | id         (PATCH/DELETE URL 에 사용)
 *   menu_id      | m_id
 *   menu_name    | m_name
 *   quantity     | o_m_qty
 *   unit_price   | unitPrice  (m_price 도 동일 값 매핑)
 *   options      | options    (배열 그대로)
 *
 * 노출값
 *   items, totalCount, totalPrice
 *   changeQuantity(id, delta)  — 수량 증감 (PATCH)
 *   removeItem(id)             — 항목 삭제 (DELETE)
 *   clearCart()                — 전체 삭제 (item 별 DELETE 반복 + lastOrder 초기화)
 *   placeOrder()               — 현재 items 를 lastOrder 스냅샷
 *   lastOrder
 * ────────────────────────────────────────────────────────────── */

/*  lastOrder sessionStorage 백업 키.
 *  Toss 결제 리다이렉트로 인한 페이지 리로드에도 end 페이지가 스냅샷을
 *  복구할 수 있도록. localStorage 가 아니라 sessionStorage — 다음 손님에게
 *  이전 주문이 노출되지 않도록 탭/앱 세션 종료 시 자동 삭제.               */
const SS_LAST_KEY = "vinus.cart.lastOrder";

const readSSArray = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/* backend CartItem → 프론트 표준 item 어댑터 */
const adaptCartItem = (sc) => ({
    id: sc.cart_item_id,
    m_id: sc.menu_id,
    m_name: sc.menu_name,
    m_price: sc.unit_price ?? 0,
    o_m_qty: sc.quantity ?? 1,
    unitPrice: sc.unit_price ?? 0,
    options: Array.isArray(sc.options) ? sc.options : [],
});

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
    const {
        cart: serverCart,
        total_price,
        session_id,
        applySessionResponse,
    } = useSession();
    const { patchCartQuantity, deleteCartItem, clearCart: apiClearCart } = useCartApi();

    // items 는 backend cart 파생
    const items = useMemo(
        () => (Array.isArray(serverCart) ? serverCart.map(adaptCartItem) : []),
        [serverCart]
    );

    // lastOrder 만 로컬 상태 (end 페이지 스냅샷)
    const [lastOrder, setLastOrder] = useState(() => readSSArray(SS_LAST_KEY) ?? []);

    useEffect(() => {
        try {
            sessionStorage.setItem(SS_LAST_KEY, JSON.stringify(lastOrder));
        } catch {
            /* quota/private mode 등 무시 */
        }
    }, [lastOrder]);

    /* 수량 증감 → PATCH /sessions/{sid}/cart/{id} { delta } */
    const changeQuantity = useCallback(
        async (id, delta) => {
            if (!session_id || !delta) return;
            const res = await patchCartQuantity(session_id, id, delta);
            if (res) applySessionResponse(res);
        },
        [session_id, patchCartQuantity, applySessionResponse]
    );

    /* 항목 삭제 → DELETE /sessions/{sid}/cart/{id} */
    const removeItem = useCallback(
        async (id) => {
            if (!session_id) return;
            const res = await deleteCartItem(session_id, id);
            if (res) applySessionResponse(res);
        },
        [session_id, deleteCartItem, applySessionResponse]
    );

    /* 전체 삭제 — DELETE /sessions/{sid}/cart (CLEAR_CART) 단일 호출.
     *  lastOrder 도 함께 초기화 (다음 손님 노출 방지). */
    const clearCart = useCallback(async () => {
        setLastOrder([]);
        if (!session_id) return;
        const res = await apiClearCart(session_id);
        if (res) applySessionResponse(res);
    }, [session_id, apiClearCart, applySessionResponse]);

    /* 결제 확정 — 현재 items 를 lastOrder 로 스냅샷.
     *  실제 backend cart 초기화는 결제 성공 시 backend 가 처리.               */
    const placeOrder = useCallback(() => {
        setLastOrder(items);
    }, [items]);

    /* 로컬 lastOrder 만 초기화 (backend cart REST 호출 없음).
     *  end 페이지처럼 세션 통째 종료(expireSession) 되는 경우 backend cart 는
     *  자동 소멸하므로 여기서는 로컬 스냅샷만 지운다.                          */
    const clearLastOrder = useCallback(() => {
        setLastOrder([]);
    }, []);

    const totalCount = useMemo(
        () => items.reduce((s, it) => s + (it.o_m_qty || 0), 0),
        [items]
    );

    /* totalPrice — backend total_price 우선 (옵션 포함 정확).
     *  0/미제공 시 items 로 fallback 계산. */
    const totalPrice = useMemo(() => {
        if (typeof total_price === "number" && total_price > 0) return total_price;
        return items.reduce(
            (s, it) => s + (it.unitPrice || 0) * (it.o_m_qty || 0),
            0
        );
    }, [total_price, items]);

    const value = useMemo(
        () => ({
            items,
            totalCount,
            totalPrice,
            changeQuantity,
            removeItem,
            clearCart,
            placeOrder,
            clearLastOrder,
            lastOrder,
        }),
        [
            items,
            totalCount,
            totalPrice,
            changeQuantity,
            removeItem,
            clearCart,
            placeOrder,
            clearLastOrder,
            lastOrder,
        ]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart를 사용하려면 CartProvider로 감싸야 합니다");
    return context;
};

export default useCart;
