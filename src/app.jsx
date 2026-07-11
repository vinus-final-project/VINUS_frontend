import { useEffect, useRef } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { CartProvider } from "./hooks/useCart";
import { SessionProvider } from "./hooks/useSession";
import { WebSocketProvider } from "./hooks/useWebSocket";
import SessionRouter from "./components/SessionRouter";
import VoiceCapture from "./components/VoiceCapture";
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
 * BootRedirect — full load(F5/주소창 직접 진입) 시 start(/) 강제 이동
 *
 * 모듈 로드 시점의 경로(BOOT_PATH)를 기억해 앱 최초 mount 에서 1회만 판정:
 *   ▸ "/"      → 그대로 (이미 start)
 *   ▸ "/pay*"  → 유지 (토스 결제창 리다이렉트 복구 — 유일한 예외)
 *   ▸ 그 외    → navigate("/", replace)
 *
 * sessionStorage 초기화(0단계)는 useSession 모듈 로드 시 이미 수행됨.
 * "/" 도착 후 start 페이지 mount 의 초기화 로직(cancelSession +
 * resetSession + clearLastOrder)이 나머지를 완결한다.
 * SPA 내부 이동에는 반응하지 않는다.
 * ────────────────────────────────────────────────────────────── */
const BOOT_PATH = window.location.pathname;

const BootRedirect = () => {
  const navigate = useNavigate();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (BOOT_PATH !== "/" && !BOOT_PATH.startsWith("/pay")) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

/* ──────────────────────────────────────────────────────────────
 * RootLayout — 공용 레이아웃
 * 9:16 폰 프레임을 화면 중앙에 고정하고, 그 안에서 페이지를 렌더한다.
 * 각 페이지는 nav/스크롤영역/footer 등 '프레임 내부 콘텐츠'만 반환한다.
 * ────────────────────────────────────────────────────────────── */
const RootLayout = () => {
  return (
    <div className="kiosk-stage">
      <div className="kiosk-frame">
        {/* full load(F5/직접 진입) 시 start 로 강제 이동 (렌더 없음) */}
        <BootRedirect />
        {/* SessionResponse 수신 → 라우팅/cart 동기화 (렌더 없음) */}
        <SessionRouter />
        {/* VAD 발화 감지 → VoiceRequest WS 전송 (렌더 없음, 전역 상주) */}
        <VoiceCapture />
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
      { path: "pay", element: <Pay /> }, // 결제 진행도 (successUrl/failUrl 공용)
      { path: "receipt", element: <Receipt /> }, // 영수증 수령
      { path: "end", element: <End /> }, // 결제 내역(완료)
      { path: "*", element: <Navigate to="/" replace /> }, // 그 외 → 메인
    ],
  },
]);

/*  Provider 중첩 순서 주의:
 *    ▸ WebSocketProvider 는 useSession() 을 호출 → SessionProvider 안쪽
 *    ▸ CartProvider  는 useSession() + useCartApi() 를 호출 → SessionProvider 안쪽
 *    ▸ 따라서 SessionProvider 가 최상위                                       */
const App = () => (
  <SessionProvider>
    <WebSocketProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </WebSocketProvider>
  </SessionProvider>
);

export default App;
