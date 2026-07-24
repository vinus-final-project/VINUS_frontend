import { useEffect } from "react";
import { createPortal } from "react-dom";
import { RECEIPT_AUTO_END_MS } from "../../../constants";
import useTts from "../../../hooks/useTts";
import "./ReceiptModal.css";

/* 대기번호 안내 모달 — 주문번호만 크게 표시
 *
 * 동작:
 *   - mount 즉시 대기번호 음성 안내(TTS)
 *   - RECEIPT_AUTO_END_MS 후 자동으로 onClose 콜백 호출
 *     (호출자가 후속 흐름 결정 — 예: 다음 UI 표시, /end 이동 등)
 *   - 사용자 클릭으로 닫는 기능은 없음 (헷갈림 방지)
 *
 * Portal 로 document.body 에 렌더 → kiosk-frame 의 overflow:hidden 등에 영향 안 받음.
 *
 * props
 *   - orderNumber: 주문번호 (프론트 발급, orderNumber.js 참고)
 *   - onClose:     자동 닫힘 시 호출 (RECEIPT_AUTO_END_MS 경과 후)
 */
export default function ReceiptModal({ orderNumber = 271, onClose }) {
  const { speak } = useTts();

  // 모달 mount 즉시 대기번호 음성 안내
  //   페이지 안내 — micGate 미부착 (duck 대상 아님, 무조건 끝까지 원래 볼륨)
  useEffect(() => {
    speak(`대기번호는 ${orderNumber}번 입니다.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  // RECEIPT_AUTO_END_MS 후 자동으로 onClose 콜백 호출
  useEffect(() => {
    const id = setTimeout(() => onClose?.(), RECEIPT_AUTO_END_MS);
    return () => clearTimeout(id);
  }, [onClose]);

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
