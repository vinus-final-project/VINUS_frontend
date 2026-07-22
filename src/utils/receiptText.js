/* ──────────────────────────────────────────────────────────────
 * receiptText — 영수증 출력용 텍스트 조립 (ESC/POS 열 정렬)
 *
 * 열 기준: 일반 58mm 감열 프린터 = 32칸 (80mm 는 48칸 — COLS 조정).
 * 한글은 프린터에서 2칸을 차지하므로 표시폭 기준으로 패딩한다.
 *
 * 사용:
 *   const text = buildReceiptText({
 *     storeName, orderNumber, items, totalPrice, orderedAt,
 *   });
 *   // items: useCart lastOrder 형식
 *   //   [{ m_name, o_m_qty, unitPrice, options: [{op_name, qty}] }]
 * ────────────────────────────────────────────────────────────── */

import { STORE_NAME } from "../constants"

/* COLS — 한 줄에 담을 문자 수.
 *   receiptImage.js 의 fontSize(30) 기준 monospace 한 글자 폭 ≈ 18도트.
 *   인쇄 폭 576도트에 30글자 담으면 30×18 = 540 (여유 36). 우측 넘치지 않음.
 *   fontSize 를 조정하면 COLS 도 같이 재계산해야 함.                       */
const COLS = 30;

/* 인쇄는 usePrinter 가 Canvas → PNG(printBase64) 방식으로 처리한다.
 * 이미지 인쇄는 ESC/POS 프리픽스가 무의미(오히려 이미지 상단에 잔재
 * 문자가 남음)하므로 INIT_CMDS 를 사용하지 않는다.                        */

/* 표시폭 계산 — 한글/전각 2칸, 그 외 1칸 */
const displayWidth = (s) =>
    [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x7f ? 2 : 1), 0);

/* 좌 텍스트 + 우 텍스트를 COLS 폭에 양끝 정렬 (넘치면 줄바꿈) */
const lineLR = (left, right) => {
    const pad = COLS - displayWidth(left) - displayWidth(right);
    if (pad < 1) return `${left}\n${" ".repeat(Math.max(0, COLS - displayWidth(right)))}${right}`;
    return `${left}${" ".repeat(pad)}${right}`;
};

/* 가운데 정렬 */
const lineCenter = (s) => {
    const pad = Math.max(0, Math.floor((COLS - displayWidth(s)) / 2));
    return `${" ".repeat(pad)}${s}`;
};

const hr = (ch = "-") => ch.repeat(COLS);

const formatWon = (n) => `${(n ?? 0).toLocaleString()}원`;

/* 주문번호 3자리 패딩 (1 → "001") */
export const formatOrderNo = (n) => String(n ?? 0).padStart(3, "0");

/* receiptImage.js 가 파싱하는 마크업:
 *   접두사 "##" — 그 줄은 큰 폰트 + 중앙 정렬로 렌더 (주문번호 등 강조용)     */
const H_PREFIX = "##";

export const buildReceiptText = ({
    storeName = STORE_NAME,
    orderNumber, // 숫자(3자리 패딩) 또는 주문 코드 문자열("A-0714-001") 모두 허용
    items = [],
    totalPrice = 0,
    orderedAt = new Date(),
}) => {
    const dt = orderedAt instanceof Date ? orderedAt : new Date(orderedAt);
    const stamp =
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-` +
        `${String(dt.getDate()).padStart(2, "0")} ` +
        `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

    const orderNoStr =
        typeof orderNumber === "string" ? orderNumber : formatOrderNo(orderNumber);

    const out = [];

    // ── 상단: 주문번호 강조 블럭 ─────────────────────────────
    out.push(hr("="));
    out.push("주문번호");
    out.push(H_PREFIX + orderNoStr);   // 큰 폰트 + 중앙정렬
    out.push(hr("="));

    // ── 매장/시각 ────────────────────────────────────────────
    out.push(storeName || "가맹점명");
    out.push(stamp);
    out.push(hr("-"));

    // ── 메뉴 항목 ────────────────────────────────────────────
    for (const it of items) {
        const qty = it.o_m_qty ?? 1;
        const price = (it.unitPrice ?? 0) * qty;
        out.push(lineLR(`${it.m_name} x${qty}`, formatWon(price)));
        for (const op of it.options ?? []) {
            const opQty = op.qty ?? 1;
            const opPrice = (op.op_price ?? 0) * opQty;
            const label =
                opQty > 1 ? ` - ${op.op_name} x${opQty}` : ` - ${op.op_name}`;
            if (opPrice > 0) {
                out.push(lineLR(label, `+ ${formatWon(opPrice)}`));
            } else {
                out.push(label);
            }
        }
    }

    out.push(hr("-"));

    // ── 합계 ─────────────────────────────────────────────────
    out.push(lineLR("합계", formatWon(totalPrice)));
    out.push(hr("="));

    // ── 감사 인사 ────────────────────────────────────────────
    out.push(lineCenter("이용해 주셔서 감사합니다"));

    out.push("\n\n\n"); // 커터 여백 (feed)

    return out.join("\n");
};

export default buildReceiptText;
