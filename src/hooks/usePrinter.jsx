import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { UsbPrinter } from "@atomsolution/usb-printer-capacitor";

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

    // 영수증 출력 — 성공 여부 반환 (실패해도 throw 하지 않음)
    const printReceipt = async (text) => {
        if (!text || !text.trim()) return false;
        try {
            setIsPrinting(true);
            setError("");

            if (Capacitor.isNativePlatform()) {
                // USB 권한 팝업(최초 1회) → 연결
                await UsbPrinter.connect();
                try {
                    await UsbPrinter.printText({ text });
                } finally {
                    // 출력 성패와 무관하게 연결 해제 (다음 출력 시 재연결)
                    try {
                        await UsbPrinter.disconnect();
                    } catch {
                        /* ignore */
                    }
                }
            } else {
                // PC 웹 dev — 모의 출력
                console.log(`[printer] (웹 모의 출력)\n${text}`);
            }
            return true;
        } catch (err) {
            console.error("[printer] 출력 실패:", err);
            setError(err?.message || "영수증 출력에 실패했습니다.");
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
