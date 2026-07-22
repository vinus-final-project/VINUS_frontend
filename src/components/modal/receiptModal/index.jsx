import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { RECEIPT_AUTO_END_MS, STORE_NAME } from "../../../constants";
import { formatKRW } from "../../../utils/format";
import useCart from "../../../hooks/useCart";
import useTts from "../../../hooks/useTts";
import { ttsStartedMic, ttsEndedMic } from "../../../utils/micGate";
import "./ReceiptModal.css";

/* 영수증 받기 모달 — 주문번호 + 주문내역 영수증 표
 *
 * 동작:
 *   - 띄워진 뒤 RECEIPT_AUTO_END_MS 후 자동으로 onClose 콜백 호출
 *     (호출자가 후속 흐름 결정 — 예: 다음 UI 표시, /end 이동 등)
 *   - 사용자 클릭으로 닫는 기능은 없음 (헷갈림 방지)
 *
 * 주문내역: pay 단계에서 placeOrder() 로 스냅샷된 lastOrder (SS 백업 —
 * Toss 리다이렉트 리로드 생존) 를 영수증 표 형식으로 렌더.
 *
 * Portal 로 document.body 에 렌더 → kiosk-frame 의 overflow:hidden 등에 영향 안 받음.
 *
 * props
 *   - orderNumber: 주문번호 (결제 confirm 응답 od_no)
 *   - onClose:     자동 닫힘 시 호출 (RECEIPT_AUTO_END_MS 경과 후)
 */
export default function ReceiptModal({ orderNumber = 271, onClose }) {
  const { lastOrder } = useCart();
  const { speak } = useTts();

  // lastOrder → 영수증 행 (메뉴/옵션/수량/금액) + 합계
  const { rows, total } = useMemo(() => {
    const rows = (lastOrder ?? []).map((it) => {
      const qty = it.o_m_qty || 1;
      return {
        id: it.id,
        name: it.m_name,
        qty,
        amount: (it.unitPrice ?? 0) * qty,
        opts: (it.options ?? [])
          .map((op) => (op.qty > 1 ? `${op.op_name} ${op.qty}개` : op.op_name))
          .join(", "),
      };
    });
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { rows, total };
  }, [lastOrder]);

  // 모달 mount 즉시 대기번호 음성 안내
  useEffect(() => {
    speak(`대기번호는 ${orderNumber}번 입니다.`, {
      onStart: ttsStartedMic,
      onEnd: ttsEndedMic,
    });
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

            {/* ── 주문내역 영수증 표 (종이 영수증 스타일) ────── */}
            {rows.length > 0 && (
              <div className="rm-receipt" aria-label="주문 내역 영수증">
                <p className="rm-receipt-store">{STORE_NAME}</p>
                <p className="rm-receipt-orderno">주문번호 {orderNumber}</p>
                <table className="rm-receipt-table">
                  <thead>
                    <tr>
                      <th className="rm-col-name">메뉴</th>
                      <th className="rm-col-qty">수량</th>
                      <th className="rm-col-amount">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="rm-col-name">
                          {r.name}
                          {r.opts && (
                            <span className="rm-receipt-opts">{r.opts}</span>
                          )}
                        </td>
                        <td className="rm-col-qty">{r.qty}</td>
                        <td className="rm-col-amount">{formatKRW(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="rm-col-name">합계</td>
                      <td className="rm-col-qty" />
                      <td className="rm-col-amount">{formatKRW(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
