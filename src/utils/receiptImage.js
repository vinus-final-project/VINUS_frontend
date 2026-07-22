/* ──────────────────────────────────────────────────────────────
 * receiptImage — 영수증 텍스트를 Canvas 로 렌더 → base64 PNG 반환
 *
 * ▸ 배경
 *   USB 프린터 플러그인(@atomsolution/usb-printer-capacitor) 의 printText 는
 *   내부적으로 UTF-8 → 프린터 code page 39(KSC5601) 변환을 하지 않아
 *   한글이 전송돼도 인쇄되지 않는다(비인쇄 문자로 처리).
 *   ESC/POS raw 명령이나 charset 지정도 API 상 노출돼 있지 않다.
 *
 * ▸ 대응
 *   printBase64(data) 는 이미지를 직접 도트 프린팅하므로 인코딩 무관.
 *   웹 Canvas 로 텍스트를 그린 뒤 PNG base64 로 넘기면 한글이 그대로 인쇄.
 *
 * ▸ 파라미터
 *   width       인쇄 폭(px). CPP-3000: 72mm × 8 dot/mm = 576.
 *   fontSize    문자 세로 크기(px). 20 전후에서 조절.
 *   charWidth   monospace 기준 문자 가로 폭(px). fontSize×0.6 근사.
 *   lineHeight  줄 높이(px).
 * ────────────────────────────────────────────────────────────── */

const DEFAULT_WIDTH = 576;      // CPP-3000 인쇄 폭 (도트)
const DEFAULT_FONT_SIZE = 30;   // 세로 크기 (원본 20 대비 1.5배)
const DEFAULT_LINE_HEIGHT = 62; // 줄 간격 (이전 78 의 0.8배)
const DEFAULT_FONT_FAMILY =
    "'D2Coding','NanumGothicCoding','Menlo','Consolas','Courier New',monospace";

/*  텍스트 문자열을 Canvas 에 렌더해 base64 PNG(data URL 프리픽스 없음) 반환.
 *  실패 시 null.                                                                 */
export function buildReceiptImageBase64(text, opts = {}) {
    if (!text) return null;
    const width = opts.width ?? DEFAULT_WIDTH;
    const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
    const lineHeight = opts.lineHeight ?? DEFAULT_LINE_HEIGHT;
    const fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
    const paddingTop = opts.paddingTop ?? 8;
    const paddingBottom = opts.paddingBottom ?? 8;
    const paddingLeft = opts.paddingLeft ?? 4;

    try {
        // 텍스트 안 ESC/POS 제어문자(\x1B~ 등) 제거 — 이미지 렌더 시 무의미
        const cleaned = text.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
        const lines = cleaned.split("\n");

        const height =
            paddingTop + paddingBottom + Math.max(1, lines.length) * lineHeight;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // 흰 배경
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 검은 텍스트
        ctx.fillStyle = "#000000";
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        lines.forEach((line, i) => {
            ctx.fillText(line, paddingLeft, paddingTop + i * lineHeight);
        });

        // data URL → base64 payload 만 잘라 반환
        const dataUrl = canvas.toDataURL("image/png");
        return dataUrl.replace(/^data:image\/png;base64,/, "");
    } catch (e) {
        console.error("[receiptImage] 렌더 실패:", e);
        return null;
    }
}

export default buildReceiptImageBase64;
