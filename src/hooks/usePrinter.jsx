import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { UsbPrinter } from "@atomsolution/usb-printer-capacitor";
import { showInfoAlert, showWarningAlert } from "../utils/alertUtils";

/* [진단 스위치] 프린터 각 단계 alert 로 확인.
 *   튕기기 직전 마지막으로 뜬 alert 가 crash 직전 지점.
 *   완료 후 false 로 두면 원상복구 (혹은 관련 라인 제거). */
const PRINTER_DIAG = true;

/* ──────────────────────────────────────────────────────────────
 * usePrinter — USB(OTG) 영수증 프린터 hook (플랫폼 하이브리드)
 *
 *   ▸ APK(Capacitor 네이티브) : @atomsolution/usb-printer-capacitor
 *       UsbManager 기반 ESC/POS 출력 — connect() 시 안드로이드
 *       USB 권한 팝업(최초 1회) 자동 처리
 *   ▸ PC 웹(dev)              : console 모의 출력 (프린터 없이 개발)
 *
 * 사용 예
 *   const { printReceipt, isPrinting } = usePrinter();
 *   const ok = await printReceipt(buildReceiptText({...}));
 *
 * 연결 정책: 출력 때마다 connect → print → disconnect.
 *   키오스크는 케이블 접촉 불량/프린터 재부팅이 잦아 연결을 물고
 *   있는 것보다 매번 여는 쪽이 안정적이다.
 *
 * ※ apk 패키징 시 필요한 네이티브 설정 (README):
 *   1) android/build.gradle 에 JitPack 저장소 추가
 *      maven { url 'https://jitpack.io' }
 *   2) 매번 권한 팝업이 뜨는 게 싫으면 AndroidManifest.xml 에
 *      USB device filter(VID/PID) intent-filter 등록
 * ────────────────────────────────────────────────────────────── */

const usePrinter = () => {
    const [error, setError] = useState("");
    const [isPrinting, setIsPrinting] = useState(false);

    // 진단용 alert 헬퍼 — PRINTER_DIAG=true 일 때만 뜸
    const diag = async (step) => {
        if (!PRINTER_DIAG) return;
        try {
            await showInfoAlert({
                title: "프린터 진단",
                text: `STEP: ${step}`,
            });
        } catch { /* ignore */ }
    };

    // 영수증 출력 — 성공 여부 반환 (실패해도 throw 하지 않음)
    const printReceipt = async (text) => {
        await diag("① 진입");
        if (!text || !text.trim()) {
            await diag("텍스트 비어있음 - 종료");
            return false;
        }
        try {
            setIsPrinting(true);
            setError("");

            if (Capacitor.isNativePlatform()) {
                await diag("② native 분기 진입");

                // UsbPrinter 플러그인 로드 여부
                if (!UsbPrinter || typeof UsbPrinter.connect !== "function") {
                    await showWarningAlert({
                        title: "프린터 진단",
                        text: "UsbPrinter 플러그인 미로드",
                    });
                    return false;
                }
                await diag("③ 플러그인 확인 OK");

                // USB 권한 팝업(최초 1회) → 연결
                await diag("④ connect() 호출 직전");
                try {
                    await UsbPrinter.connect();
                    await diag("⑤ connect() 성공");
                } catch (e) {
                    await showWarningAlert({
                        title: "프린터 진단",
                        text: `connect() 실패: ${e?.message ?? e}`,
                    });
                    return false;
                }

                try {
                    await diag("⑥ printText() 호출 직전");
                    await UsbPrinter.printText({ text });
                    await diag("⑦ printText() 성공");
                } catch (e) {
                    await showWarningAlert({
                        title: "프린터 진단",
                        text: `printText() 실패: ${e?.message ?? e}`,
                    });
                } finally {
                    // 출력 성패와 무관하게 연결 해제 (다음 출력 시 재연결)
                    try {
                        await diag("⑧ disconnect() 호출 직전");
                        await UsbPrinter.disconnect();
                        await diag("⑨ disconnect() 성공");
                    } catch {
                        /* ignore */
                    }
                }
            } else {
                // PC 웹 dev — 모의 출력
                console.log(`[printer] (웹 모의 출력)\n${text}`);
            }
            await diag("⑩ 정상 완료");
            return true;
        } catch (err) {
            console.error("[printer] 출력 실패:", err);
            setError(err?.message || "영수증 출력에 실패했습니다.");
            await showWarningAlert({
                title: "프린터 진단",
                text: `outer catch: ${err?.message ?? err}`,
            });
            return false;
        } finally {
            setIsPrinting(false);
        }
    };

    return {
        error,
        setError,
        isPrinting,
        printReceipt,
    };
};

export default usePrinter;
