import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { STORE_NAME } from "../../../constants";
import { formatKRW } from "../../../utils/format";
import useCart from "../../../hooks/useCart";
import "../receiptModal/ReceiptModal.css";

/* ──────────────────────────────────────────────────────────────
 * OrderSummaryModal — 주문내역 표(종이 영수증 스타일) 팝업
 *
 * 사용 흐름:
 *   receipt 페이지에서 "영수증 안 받기" 를 선택한 사용자는 실물 영수증을
 *   받지 못하므로, end 페이지 진입 직후 잠깐 주문내역을 팝업으로 보여준다.
 *
 * - autoCloseMs 후 onClose 자동 호출 (기본 3000ms)
 * - 사용자 클릭 close 없음 (헷갈림 방지)
 * - CSS 는 receiptModal/ReceiptModal.css 재사용 (.rm-receipt 등)
 *
 * props
 *   - orderNumber: 대기번호
 *   - autoCloseMs: 자동 닫힘 (ms). 기본 3000
 *   - onClose:     자동 닫힘 콜백
 * ────────────────────────────────────────────────────────────── */
export default function OrderSummaryModal({
  orderNumber,
  autoCloseMs = 3000,
  onClose,
}) {
  const { lastOrder } = useCart();

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

  useEffect(() => {
    const id = setTimeout(() => onClose?.(), autoCloseMs);
    return () => clearTimeout(id);
  }, [autoCloseMs, onClose]);

  return createPortal(
    <div className="receipt-modal" role="dialog" aria-modal="true">
      <div className="rm-inner">
        <div className="rm-center">
          <div className="rm-card">
            <div className="rm-receipt" aria-label="주문 내역 영수증">
              <p className="rm-receipt-store">{STORE_NAME}</p>
              {orderNumber != null && (
                <p className="rm-receipt-orderno">주문번호 {orderNumber}</p>
              )}
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
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
