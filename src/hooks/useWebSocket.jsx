import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from "react";
import useSession from "./useSession";

/* ──────────────────────────────────────────────────────────────
 * useWebSocket — /ws/voice 연결/송수신 (Context + Custom Hook)
 *
 * Endpoint: ${VITE_WS_URL}/ws/voice
 *
 * 송신 (Frontend → Backend) — 명세 WebSocket API Request
 *   1) JSON Metadata (sendJson): { session_id, audio_format,
 *                                  sample_rate, channels }
 *   2) PCM Binary Frame (sendBinary): voice_data (ArrayBuffer)
 *   ※ "JSON Metadata 수신 후 가장 먼저 도착하는 PCM Binary Frame을
 *      동일 요청으로 처리" — WebSocket.md 정책
 *
 * 수신 (Backend → Frontend) — SessionResponse(JSON only)
 *   onmessage → JSON.parse → useSession.applySessionResponse
 *
 * 연결 상태(status)
 *   "disconnected" → "connecting" → "connected" → ("disconnected")
 *
 * 사용 예
 *   const { status, connect, disconnect, sendJson, sendBinary } = useWebSocket();
 *   connect(session_id);
 *   sendJson({ session_id, audio_format: "pcm_s16le", sample_rate: 16000, channels: 1 });
 *   sendBinary(pcmInt16ArrayBuffer);
 *
 * 노출 값
 *   status, error, connect(sessionId), disconnect(),
 *   sendJson(obj), sendBinary(arrayBuffer)
 * ────────────────────────────────────────────────────────────── */

const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const WS_VOICE_PATH = "/ws/voice";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { applySessionResponse } = useSession();

    // ws 인스턴스는 useRef 로 보관 (재렌더링과 무관)
    const wsRef = useRef(null);

    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState("");

    /* ── 연결 ─────────────────────────────────────────────── */
    const connect = useCallback(
        (sessionId) => {
            if (
                wsRef.current &&
                (wsRef.current.readyState === WebSocket.OPEN ||
                    wsRef.current.readyState === WebSocket.CONNECTING)
            ) {
                console.warn("[useWebSocket] 이미 연결됨/연결 중");
                return;
            }
            try {
                setStatus("connecting");
                setError("");

                // session_id 는 optional — start 페이지 mount 시점처럼 세션 발급
                // 전에도 연결 가능해야 한다. 있으면 URL query 로 전달하고,
                // 이후 JSON Metadata(VoiceRequest) 에도 포함시킨다.
                const url = sessionId
                    ? `${WS_BASE_URL}${WS_VOICE_PATH}?session_id=${encodeURIComponent(sessionId)}`
                    : `${WS_BASE_URL}${WS_VOICE_PATH}`;
                const ws = new WebSocket(url);
                ws.binaryType = "arraybuffer";

                ws.onopen = () => {
                    console.log("[useWebSocket] open");
                    setStatus("connected");
                };

                ws.onmessage = (event) => {
                    // backend → frontend 는 JSON only (SessionResponse)
                    if (typeof event.data === "string") {
                        try {
                            const json = JSON.parse(event.data);
                            applySessionResponse(json);
                        } catch (err) {
                            console.error("[useWebSocket] JSON 파싱 실패:", err, event.data);
                        }
                    } else {
                        console.warn("[useWebSocket] 예기치 못한 binary 응답 수신 (무시)");
                    }
                };

                ws.onerror = (e) => {
                    console.error("[useWebSocket] error:", e);
                    setError("WebSocket 오류가 발생했습니다.");
                };

                ws.onclose = (event) => {
                    console.log("[useWebSocket] close", event.code, event.reason);
                    setStatus("disconnected");
                    wsRef.current = null;
                };

                wsRef.current = ws;
            } catch (err) {
                console.error("[useWebSocket] connect 실패:", err);
                setError(err.message || "WebSocket 연결에 실패했습니다.");
                setStatus("disconnected");
            }
        },
        [applySessionResponse]
    );

    /* ── 종료 ─────────────────────────────────────────────── */
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch (err) {
                console.error("[useWebSocket] close 실패:", err);
            }
            wsRef.current = null;
        }
        setStatus("disconnected");
    }, []);

    /* ── 송신: JSON Metadata ─────────────────────────────── */
    const sendJson = useCallback((obj) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn("[useWebSocket] 연결 안됨 — sendJson 무시:", obj);
            return false;
        }
        ws.send(JSON.stringify(obj));
        return true;
    }, []);

    /* ── 송신: PCM Binary Frame ──────────────────────────── */
    const sendBinary = useCallback((buffer) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn("[useWebSocket] 연결 안됨 — sendBinary 무시");
            return false;
        }
        ws.send(buffer);
        return true;
    }, []);

    /* ── 세션 바인딩 ──────────────────────────────────────
     * 터치 흐름으로 세션이 생성된 경우(POST /sessions),
     * 이미 열려있는 이 연결에 session_id 를 매핑하도록
     * backend 에 BIND_SESSION 제어 메시지를 보낸다.
     * (음성 흐름에서는 backend 가 첫 발화 처리 시 스스로 bind)      */
    const bindSession = useCallback(
        (sessionId) => {
            if (!sessionId) return false;
            return sendJson({ type: "BIND_SESSION", session_id: sessionId });
        },
        [sendJson]
    );

    /* ── 언마운트 시 정리 ─────────────────────────────────── */
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {
                    // ignore
                }
            }
        };
    }, []);

    const value = useMemo(
        () => ({
            status,
            error,
            connect,
            disconnect,
            sendJson,
            sendBinary,
            bindSession,
        }),
        [status, error, connect, disconnect, sendJson, sendBinary, bindSession]
    );

    return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useWebSocket = () => {
    const ctx = useContext(WebSocketContext);
    if (!ctx) throw new Error("useWebSocket을 사용하려면 WebSocketProvider로 감싸야 합니다");
    return ctx;
};

export default useWebSocket;
