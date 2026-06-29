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
 * Cart item shape:
 *   {
 *     id:       string  (cart 내 고유 키)
 *     menuId:   string|number
 *     name:     string                ("솔티드 쿨 리치")
 *     basePrice: number              (메뉴 기본가)
 *     cup:      string               ("일회용" / "개인 텀블러")
 *     sugar:    number               (1 | 2)
 *     strength: string               ("연하게" / "진하게")
 *     paid:     [{ id, name, price, count }]
 *     quantity: number
 *     unitPrice: number              (basePrice + sum(paid.price * count))
 *   }
 *
 * 노출하는 값:
 *   items, addItem(item), removeItem(id), changeQuantity(id, delta), clearCart()
 *   totalCount  — 모든 item.quantity 합
 *   totalPrice  — 모든 (unitPrice * quantity) 합
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
          ? { ...it, quantity: Math.max(1, (it.quantity || 0) + delta) }
          : it
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const placeOrder = useCallback(() => {
    setItems((prev) => {
      // 현재 items 를 snapshot 으로
      setLastOrder(prev);
      return [];
    });
  }, []);

  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.quantity || 0), 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      changeQuantity,
      clearCart,
      placeOrder,
      lastOrder,
      totalCount,
      totalPrice,
    }),
    [items, addItem, removeItem, changeQuantity, clearCart, placeOrder, lastOrder, totalCount, totalPrice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart를 사용하려면 CartProvider로 감싸야 합니다");
  return context;
};

export default useCart;
