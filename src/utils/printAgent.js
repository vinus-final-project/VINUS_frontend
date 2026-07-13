/* ──────────────────────────────────────────────────────────────
 * printAgent — 로컬 프린트 에이전트 호출 유틸
 *
 * 백엔드가 AWS 에 있어 프린터(키오스크 PC USB)에 닿을 수 없으므로,
 * 같은 PC 에서 도는 프린트 에이전트(print_agent/main.py, 127.0.0.1:8300)
 * 에 주문내역을 보내 영수증을 출력한다.
 *
 * backend api 유틸과 별개인 이유: base URL 이 다르고(localhost 고정),
 * 에이전트가 꺼져 있어도 주문 흐름을 막으면 안 되기 때문 (짧은 타임아웃).
 * ────────────────────────────────────────────────────────────── */

import { PRINT_AGENT_URL } from "../constants";

/* lastOrder 스냅샷(useCart) + 주문번호 → 에이전트 PrintRequest 변환.
 * 항목 amount = unitPrice(옵션 포함 단가) × 수량 — 결제 금액과 동일 기준. */
export const buildPrintPayload = (lastOrder, orderNo, orderType = null) => {
    const items = (lastOrder ?? []).map((it) => ({
        name: it.m_name,
        qty: it.o_m_qty || 1,
        amount: (it.unitPrice ?? 0) * (it.o_m_qty || 1),
        options: (it.options ?? []).map((op) => ({
            name: op.op_name,
            price: op.op_price ?? 0,
            qty: op.qty ?? 1,
        })),
    }));
    return {
        od_no: orderNo,
        total_price: items.reduce((s, r) => s + r.amount, 0),
        items,
        order_type: orderType, // "STORE"/"TAKEOUT" — 없으면 null (줄 생략)
    };
};

/* 영수증 출력 요청 — 성공 여부만 반환 (실패해도 화면 흐름은 계속).
 * 에이전트 미기동/프린터 오류 대비 3초 타임아웃. */
export const printReceipt = async (payload) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
        const res = await fetch(`${PRINT_AGENT_URL}/print`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!res.ok) {
            console.error("[printAgent] 출력 실패", res.status, await res.text());
            return false;
        }
        return true;
    } catch (err) {
        console.error("[printAgent] 에이전트 연결 실패 (미기동?)", err);
        return false;
    } finally {
        clearTimeout(timer);
    }
};
