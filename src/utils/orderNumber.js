/* ──────────────────────────────────────────────────────────────
 * orderNumber — 프론트 관리 주문번호 (영업일 단위 001부터 증가)
 *
 * 저장소: localStorage (sessionStorage 아님)
 *   ▸ 앱/탭 재시작에도 당일 번호가 이어져야 함 (키오스크 재부팅 대응)
 *   ▸ 영업일이 바뀌면 자동으로 001 부터 리셋
 *
 * 영업일 기준: 한국 시간(KST, UTC+9) 오전 6시.
 *   새벽 영업(0~6시)은 전날 영업일로 취급 — 5:59 주문은 전날 번호를
 *   이어가고, 6:00 첫 주문부터 001. 기기 OS 시간대와 무관하게
 *   KST 로 계산한다.
 *
 * 사용:
 *   issueOrderNumber() — 결제 완료 시점에 1회 호출 → 새 번호 발급
 *   peekOrderNumber()  — 마지막 발급 번호 조회 (receipt/end 표시용)
 *   formatOrderNo(n)   — 3자리 패딩 ("001") — utils/receiptText 재수출
 * ────────────────────────────────────────────────────────────── */

const LS_KEY = "vinus.orderNumber";

/* 영업일 날짜 문자열 ("YYYY-MM-DD") — KST 오전 6시가 하루의 시작.
 * now(UTC) + 9h = KST, 거기서 -6h 하면 "6시 이전 = 전날" 이 되므로
 * 그 시각의 UTC 날짜 필드가 곧 영업일이다.                            */
const businessDateStr = () => {
    const shifted = new Date(Date.now() + (9 - 6) * 3600_000);
    return shifted.toISOString().slice(0, 10);
};

const read = () => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed?.no === "number" && typeof parsed?.date === "string"
            ? parsed
            : null;
    } catch {
        return null;
    }
};

const write = (data) => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
        /* quota/private mode 등 무시 */
    }
};

/* 새 주문번호 발급 — 결제 완료 시점에 1회 호출.
 * 영업일이 바뀌었으면 1부터, 아니면 마지막 번호 +1.                   */
export const issueOrderNumber = () => {
    const today = businessDateStr();
    const cur = read();
    const next = cur && cur.date === today ? cur.no + 1 : 1;
    write({ date: today, no: next });
    return next;
};

/* 마지막 발급 번호 조회 (증가 없음) — receipt/end 표시용.
 * 발급 이력이 없거나 영업일이 지났으면 0 반환.                        */
export const peekOrderNumber = () => {
    const cur = read();
    return cur && cur.date === businessDateStr() ? cur.no : 0;
};

export { formatOrderNo } from "./receiptText";
