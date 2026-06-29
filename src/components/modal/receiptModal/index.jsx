import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { RECEIPT_AUTO_END_MS } from "../../../constants";
import "./ReceiptModal.css";

/* 영수증 받기 모달 — '영수증 상단 주문번호' 안내 팝업
 *
 * 동작:
 *   - 띄워진 뒤 RECEIPT_AUTO_END_MS(=3000ms) 후 자동으로 /end 로 이동
 *   - 사용자 클릭으로 닫는 기능은 없음 (헷갈림 방지)
 *
 * Portal 로 document.body 에 렌더 → kiosk-frame 의 overflow:hidden 등에 영향 안 받음.
 *
 * props
 *   - orderNumber: 주문번호 (실제로는 결제 응답에서 받아 전달)
 */
export default function ReceiptModal({ orderNumber = 271 }) {
  const navigate = useNavigate();

  // 3초 후 자동으로 결제내역(end) 페이지로
  useEffect(() => {
    const id = setTimeout(() => navigate("/end"), RECEIPT_AUTO_END_MS);
    return () => clearTimeout(id);
  }, [navigate]);

  return createPortal(
    <div className="receipt-modal" role="dialog" aria-modal="true">
      <div className="rm-inner">
        <div className="rm-center">
          <div className="rm-card">
            <p className="rm-card-title">
              영수증 상단 주문번호를
              <br />
              확인해주세요
            </p>
            <p className="rm-card-number">{orderNumber}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
