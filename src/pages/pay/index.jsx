import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useCart from "../../hooks/useCart";
import "./pay.css";

/* ──────────────────────────────────────────────────────────────
 * Pay — 결제 진행 페이지
 *
 * 명세: header / footer 없이, 오렌지 원(상단)과 안내문(하단) 2단 구성.
 *
 * 흐름:
 *   1) "processing"  — "결제 중입니다…" + 살짝 옅은 펄스 원
 *   2) 3초 후 "done" — "결제가 완료되었습니다!" + 진한 원
 *      ↳ 이 시점에 placeOrder() 호출 → 장바구니를 lastOrder 로 snapshot 한 뒤 비움
 *   3) 다시 3초 후   — /receipt 페이지로 이동
 *
 *   실제로는 백엔드 결제 API 응답을 기다려 setStatus("done") 으로 전환하고,
 *   그 후 다시 백엔드 후처리(영수증 발급 등) 응답을 받아 navigate("/receipt") 한다.
 *   아래 useEffect 안의 TODO 자리를 실제 fetch 호출로 교체하면 됨.
 * ────────────────────────────────────────────────────────────── */

export default function Pay() {
  const navigate = useNavigate();
  const { placeOrder } = useCart();
  const [status, setStatus] = useState("processing");

  /* ── 1단계: 결제 처리(processing) ─ 응답을 기다렸다가 done 으로 전환 ── */
  useEffect(() => {
    let alive = true;

    // TODO(실제): 백엔드 결제 라우트 호출 후 성공 응답을 받아 setStatus("done").
    //   const res = await fetch("/api/pay", { method: "POST" });
    //   if (alive && res.ok) setStatus("done");

    // 데모(엔드포인트 연결 전): 3초 후 자동으로 done 으로 전환
    const id = setTimeout(() => alive && setStatus("done"), 3000);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);

  /* ── 2단계: 결제 완료(done) ─ 장바구니 commit + receipt 페이지로 이동 ── */
  useEffect(() => {
    if (status !== "done") return;

    // 결제 완료 → 현재 장바구니를 lastOrder 로 snapshot (end 페이지에서 표시),
    //               동시에 장바구니 비움 (다음 주문 대비)
    placeOrder();

    // TODO(실제): 백엔드 후처리(영수증 발급 등) 응답을 받은 뒤 navigate("/receipt").
    //   const res = await fetch("/api/pay/finalize");
    //   if (res.ok) navigate("/receipt");

    // 데모: 3초 후 자동으로 영수증 선택 페이지로 이동
    const id = setTimeout(() => navigate("/receipt"), 3000);
    return () => clearTimeout(id);
  }, [status, navigate, placeOrder]);

  return (
    <div className="pay-body">
      <div
        className={`pay-indicator ${status === "processing" ? "is-loading" : ""}`}
        aria-hidden="true"
      />
      <p className="pay-message" role="status" aria-live="polite">
        {status === "processing" ? (
          <>
            결제 중입니다...
            <br />
            잠시만 기다려주세요
          </>
        ) : (
          <>
            결제가 완료되었습니다!
            <br />
            카드를 제거해주세요
          </>
        )}
      </p>
    </div>
  );
}
