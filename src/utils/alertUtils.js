import Swal from "sweetalert2";

/* ──────────────────────────────────────────────────────────────
 * alertUtils — SweetAlert2 알림창 템플릿
 *
 * 브라우저 기본 alert/confirm 대신 사용 (키오스크 UI 톤 통일).
 * 컬러는 프로젝트 팔레트를 따른다.
 *
 * 사용처
 *   showInfoAlert     — main / navbar / order / orderDetail / cart / payment
 *   showWarningAlert  — order / orderDetail / cart / payment
 *   showSuccessAlert  — (예약)
 *   showWarningDialog — 확인/취소 2버튼 (예약)
 * ────────────────────────────────────────────────────────────── */

/** 확인/취소 2버튼 다이얼로그 — 확인 시 true */
export async function showWarningDialog({
                                            title,
                                            text,
                                            confirmText = "삭제",
                                            cancelText = "취소",
                                        } = {}) {
    const result = await Swal.fire({
        title: title,
        text: text,
        width: '330px',
        icon: "warning",
        iconColor: "#E89B9B",
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: "#E89B9B",
        cancelButtonColor: "#EEF2F5",
        reverseButtons: true,
    });
    return result.isConfirmed;
}

/** 성공 팝업 */
export function showSuccessAlert({ title, text } = {}) {
    return Swal.fire({
        title : title,
        text : text,
        width: '330px',
        icon: "success",
        confirmButtonColor: "#A8C8D8",
    });
}

/** 정보 팝업 */
export function showInfoAlert({ title, text } = {}) {
    return Swal.fire({
        title: title,
        text: text,
        width: '330px',
        icon: "info",
        confirmButtonColor: "#A8C8D8",
    });
}

/** 경고 팝업 */
export function showWarningAlert({ title, text } = {}) {
    return Swal.fire({
        title: title,
        text: text,
        width: '300px',
        icon: "warning",
        iconColor: "#E89B9B",
        confirmButtonColor: "#A8C8D8",
    });
}
