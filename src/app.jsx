import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import { CartProvider } from "./hooks/useCart";
import { SessionProvider } from "./hooks/useSession";
import { WebSocketProvider } from "./hooks/useWebSocket";
import SessionRouter from "./components/SessionRouter";
import "./app.css";

import Start from "./pages/start";
import Main from "./pages/main";
import Order from "./pages/order";
import OrderDetail from "./pages/orderDetail";
import Cart from "./pages/cart";
import Payment from "./pages/payment";
import Pay from "./pages/pay";
import Receipt from "./pages/receipt";
import End from "./pages/end";

/* ──────────────────────────────────────────────────────────────
 * RootLayout — 공용 레이아웃
 * 9:16 폰 프레임을 화면 중앙에 고정하고, 그 안에서 페이지를 렌더한다.
 * 각 페이지는 nav/스크롤영역/footer 등 '프레임 내부 콘텐츠'만 반환한다.
 * ────────────────────────────────────────────────────────────── */
const RootLayout = () => {
  return (
    <div className="kiosk-stage">
      <div className="kiosk-frame">
        {/* SessionResponse 수신 → 라우팅/cart 동기화 (렌더 없음) */}
        <SessionRouter />
        <Outlet />
        {/* 전역 팝업/모달이 필요하면 여기에 배치 (예: <InterferencePopup />) */}
      </div>
    </div>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Start /> }, // 스플래시(프로그램 실행 시 첫 화면)
      { path: "main", element: <Main /> }, // 메인(매장/포장 선택)
      { path: "order", element: <Order /> }, // 전체 메뉴
      { path: "menu/:menuId", element: <OrderDetail /> }, // 메뉴 상세
      { path: "cart", element: <Cart /> }, // 장바구니
      { path: "payment", element: <Payment /> }, // 결제 방법 선택
      { path: "pay", element: <Pay /> }, // 결제 진행도
      { path: "receipt", element: <Receipt /> }, // 영수증 수령
      { path: "end", element: <End /> }, // 결제 내역(완료)
      { path: "*", element: <Navigate to="/" replace /> }, // 그 외 → 메인
    ],
  },
]);

/*  Provider 중첩 순서 주의:
 *    WebSocketProvider 내부에서 useSession() 을 호출하므로
 *    SessionProvider 가 반드시 바깥쪽에 위치해야 한다.                */
const App = () => (
  <CartProvider>
    <SessionProvider>
      <WebSocketProvider>
        <RouterProvider router={router} />
      </WebSocketProvider>
    </SessionProvider>
  </CartProvider>
);

export default App;
