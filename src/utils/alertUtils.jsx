import Swal from "sweetalert2";
import { buildFileUrl } from "./api";

const sharedCustomClass = {
    title: "!text-lg font-bold pt-6",
    popup: "rounded-3xl",
    confirmButton: "px-6 py-3 rounded-2xl",
    cancelButton: "px-6 py-3 rounded-2xl text-[#3D4D5C]",
};

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
        customClass: sharedCustomClass,
    });
    return result.isConfirmed;
}

/** 성공 토스트/팝업 */
export function showSuccessAlert({ title, text } = {}) {
    return Swal.fire({
        title : title,
        text : text,
        width: '330px',
        icon: "success",
        confirmButtonColor: "#A8C8D8",
        customClass: sharedCustomClass,
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
        customClass: sharedCustomClass,
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
        customClass: sharedCustomClass,
    });
}
/** 보상 팝업 */
export const showAttendanceReward = (totalDays, clothTitle, clothFileUrl) => {
    return Swal.fire({
        title: `누적 ${totalDays}일 출석 달성!`,
        html: `
            <div style="text-align:center;">
                <img src="${buildFileUrl(clothFileUrl)}"
                     alt="${clothTitle}"
                     style="width:120px;height:120px;object-fit:cover;border-radius:50%;margin:16px auto;display:block;background:#F5F8FA;" />
                <p style="font-weight:bold;color:#3D4D5C;margin-top:8px;font-size:15px;">${clothTitle}</p>
                <p style="color:#8B9BAA;font-size:13px;margin-top:6px;">새로운 프로필이 해금되었어요</p>
            </div>
        `,
        width: '330px',
        confirmButtonColor: "#A8C8D8",
        confirmButtonText: "확인",
    });
};

export function showDeadlineAlert({ hoursLeft, mode } = {}) {
    const isStrict = mode === 0; // 0: 엄격, 1: 경박

    const messages = {
        4: {
            strict: "마감 4시간 전이야. 아직 안 했으면 지금 당장 시작해.",
            less:   "야야야!!! 4시간 남았어!!!! 설마 아직도 안 한 거 아니지???",
        },
        2: {
            strict: "2시간 남았어. 진짜로. 지금 안 하면 후회한다.",
            less:   "2시간!!!!!! 어???? 아직도????? 빨리 해!!!!!",
        },
        1: {
            strict: "1시간 남았어. 할 거야, 말 거야.",
            less:   "1시간!!!!! 야 이거 진짜야???? 지금 당장 해!!!!!!",
        },
    };

    const msg = messages[hoursLeft];
    const text = isStrict ? msg.strict : msg.less;
    const icon = isStrict ? "warning" : "error";
    const iconColor = isStrict ? "#E89B9B" : "#FFB347";

    return Swal.fire({
        title: `⏰ 마감 ${hoursLeft}시간 전!`,
        text,
        width: "330px",
        icon,
        iconColor,
        confirmButtonColor: "#A8C8D8",
        confirmButtonText: "알겠어",
        customClass: sharedCustomClass,
    });
}