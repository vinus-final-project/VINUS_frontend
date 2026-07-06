import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/*  sessionStorage 백업 키.
 *
 *  토스 결제창 successUrl / failUrl 리다이렉트는 브라우저 페이지 전체 리로드라
 *  React Context state 가 초기화된다. 결제 성공 후 end 페이지에서 lastOrder 를
 *  표시하려면 items 와 lastOrder 를 브라우저 세션 스토리지에 백업해두었다가
 *  App remount 시 복구해야 한다.
 *
 *  sessionStorage 를 쓰는 이유:
 *    - localStorage 는 브라우저를 완전히 닫아도 유지 → 다음 손님에게 노출 위험
 *    - sessionStorage 는 탭/앱 세션 종료 시 자동 삭제 → 키오스크 특성에 적합    */
const SS_ITEMS_KEY = "vinus.cart.items";
const SS_LAST_KEY = "vinus.cart.lastOrder";

const readSS = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/* ──────────────────────────────────────────────────────────────
 * useCart — 장바구니 전역 상태 (Context + Custom Hook)
 *
 * 사용 예:
 *   // 1) 루트에 Provider 감싸기
 *   import { CartProvider } from "./hooks/useCart";
 *   <CartProvider><App /></CartProvider>
 *
 *   // 2) 컴포넌트에서 default export 된 customHook 사용
 *   import useCart from "../hooks/useCart";
 *   const { items, addItem, totalPrice } = useCart();
 *
 * Cart item shape — backend 주문 스키마(orders / orderMenus / orderMenuOptions)와 정합
 *   {
 *     id:        string   (cart 내 고유 키, frontend 전용)
 *     m_id:      number   (menus.m_id)
 *     m_name:    string   (표시용, menus.m_name)
 *     m_price:   number   (단가, menus.m_price)
 *     o_m_qty:   number   (orderMenus.o_m_qty)
 *     options:   [        (선택된 옵션. backend로는 op_id 만 전송)
 *       { op_id: number, op_name: string, op_price: number,
 *         og_id?: number, og_name?: string }
 *     ]
 *     unitPrice: number   (m_price + sum(options.op_price), UI 표시용 캐시)
 *   }
 *
 *   주문 전송 시 매핑 (POST /orders 예정 — 추후 구현):
 *     orderMenus       ← { m_id, o_m_qty }
 *     orderMenuOptions ← options.map(o => ({ op_id: o.op_id }))
 *
 * 노출하는 값:
 *   items, addItem(item), removeItem(id), changeQuantity(id, delta), clearCart()
 *   totalCount  — 모든 item.o_m_qty 합
 *   totalPrice  — 모든 (unitPrice * o_m_qty) 합
 *   placeOrder() — 현재 cart 를 lastOrder 로 snapshot 한 뒤 비움
 *   lastOrder    — 직전 결제 완료된 항목들의 snapshot
 * ────────────────────────────────────────────────────────────── */

const CartContext = createContext(null);

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const CartProvider = ({ children }) => {
  // 초기값은 sessionStorage 에서 복구 (없으면 빈 배열)
  const [items, setItems] = useState(() => readSS(SS_ITEMS_KEY) ?? []);
  const [lastOrder, setLastOrder] = useState(() => readSS(SS_LAST_KEY) ?? []);

  // 변경 시 sessionStorage 로 백업
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_ITEMS_KEY, JSON.stringify(items));
    } catch { /* quota/private mode 등 무시 */ }
  }, [items]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_LAST_KEY, JSON.stringify(lastOrder));
    } catch { /* ignore */ }
  }, [lastOrder]);

  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, { ...item, id: item.id ?? genId() }]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // 수량 증감 (delta = ±1 등). 최소 1 유지 (0 이면 X 로 삭제 유도).
  const changeQuantity = useCallback((id, delta) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, o_m_qty: Math.max(1, (it.o_m_qty || 0) + delta) }
          : it
      )
    );
  }, []);

  /*  clearCart — items 뿐 아니라 lastOrder 도 함께 초기화.
   *  end 페이지가 홈으로 이동하기 직전에 호출하여 다음 세션이 이전 주문
   *  내역을 보지 못하도록 한다. sessionStorage 백업도 useEffect 로 동기화됨.  */
  const clearCart = useCallback(() => {
    setItems([]);
    setLastOrder([]);
  }, []);

  /* 서버 SessionResponse.cart → 로컬 items 동기화 (서버가 SoT).
   * backend CartItem 스키마가 아직 미확정이라 필드명을 관대하게 매핑.
   * 확정되면 이 어댑터만 손보면 됨. */
  const syncFromServer = useCallback((serverCart) => {
    if (!Array.isArray(serverCart)) return;
    setItems(
      serverCart.map((sc, idx) => {
        const options = Array.isArray(sc.options) ? sc.options : [];
        const optionPrice = options.reduce((sum, o) => sum + (o.op_price || 0), 0);
        const mPrice = sc.m_price ?? sc.price ?? 0;
        return {
          id: sc.cart_item_id ?? sc.id ?? `srv-${idx}`,
          m_id: sc.m_id,
          m_name: sc.m_name ?? sc.name ?? "메뉴",
          m_price: mPrice,
          o_m_qty: sc.o_m_qty ?? sc.quantity ?? 1,
          options,
          unitPrice: sc.unit_price ?? sc.unitPrice ?? mPrice + optionPrice,
        };
      })
    );
  }, []);

  /*  주문 확정 — 현재 items 를 lastOrder 로 snapshot 만 저장한다.
   *  장바구니 items 는 그대로 유지 (end 페이지에서 표시하기 위해).
   *  실제 clearCart 는 end 페이지가 홈으로 이동하기 직전에 호출한다.  */
  const placeOrder = useCallback(() => {
    setItems((prev) => {
      setLastOrder(prev);
      return prev;
    });
  }, []);

  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.o_m_qty || 0), 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.o_m_qty || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      changeQuantity,
      clearCart,
      syncFromServer,
      placeOrder,
      lastOrder,
      totalCount,
      totalPrice,
    }),
    [items, addItem, removeItem, changeQuantity, clearCart, syncFromServer, placeOrder, lastOrder, totalCount, totalPrice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart를 사용하려면 CartProvider로 감싸야 합니다");
  return context;
};

export default useCart;
