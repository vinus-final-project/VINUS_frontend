import { createContext, useCallback, useContext, useMemo, useState } from "react";

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
  const [items, setItems] = useState([]);
  const [lastOrder, setLastOrder] = useState([]);

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

  const clearCart = useCallback(() => setItems([]), []);

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

  const placeOrder = useCallback(() => {
    setItems((prev) => {
      // 현재 items 를 snapshot 으로
      setLastOrder(prev);
      return [];
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
