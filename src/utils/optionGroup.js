/* ──────────────────────────────────────────────────────────────
 * optionGroup — 옵션명(op_name) → 옵션 그룹명(og_name) 매핑
 *
 * 배경:
 *   backend CartItemOption 은 { op_id, op_name, op_price, qty } 만 담고
 *   og_name(옵션 그룹명)을 포함하지 않는다. /menus/all 부트스트랩 캐시에도
 *   option_groups 가 없어, 영수증에 "온도: ICE" 형식을 찍으려면 그룹명을
 *   프론트에서 알아야 한다.
 *
 * 방식:
 *   backend/app/db/seed.py 의 옵션 그룹 템플릿(TPL_*)을 그대로 하드코딩.
 *   현재 시드 기준 op_name 은 그룹 간 중복이 없어 이름만으로 역매핑 가능.
 *
 * ⚠ 시드(seed.py)의 옵션 구성이 바뀌면 이 맵도 함께 갱신해야 한다.
 *   매칭 실패 시 null 을 반환하고, 호출부는 그룹명 없이 옵션명만 출력한다.
 *
 * seed.py 대응표 (2026-07-25 기준)
 *   온도       : HOT, ICE
 *   사이즈     : 레귤러, 라지
 *   샷 추가    : 샷 추가
 *   시럽 추가  : 바닐라 시럽, 헤이즐넛 시럽, 카라멜 시럽
 *   휘핑 추가  : 휘핑 추가
 *   펄 추가    : 펄 추가
 *   당도       : 0%, 50%, 100%
 *   얼음량     : 적게, 보통, 많이
 * ────────────────────────────────────────────────────────────── */

/* op_name → og_name (seed.py TPL_* 역매핑) */
const OG_BY_OP_NAME = {
    // TPL_TEMP — 온도
    HOT: "온도",
    ICE: "온도",
    // TPL_SIZE — 사이즈
    레귤러: "사이즈",
    라지: "사이즈",
    // TPL_SHOT — 샷 추가 (그룹명 = 옵션명)
    "샷 추가": "샷 추가",
    // TPL_SYRUP — 시럽 추가
    "바닐라 시럽": "시럽 추가",
    "헤이즐넛 시럽": "시럽 추가",
    "카라멜 시럽": "시럽 추가",
    // TPL_WHIP — 휘핑 추가 (그룹명 = 옵션명)
    "휘핑 추가": "휘핑 추가",
    // TPL_PEARL — 펄 추가 (그룹명 = 옵션명)
    "펄 추가": "펄 추가",
    // TPL_SWEET — 당도
    "0%": "당도",
    "50%": "당도",
    "100%": "당도",
    // TPL_ICE — 얼음량
    적게: "얼음량",
    보통: "얼음량",
    많이: "얼음량",
};

/** op_name 으로 옵션 그룹명 조회 — 미등록이면 null */
export const resolveOptionGroupName = (opName) => {
    if (!opName) return null;
    return OG_BY_OP_NAME[String(opName).trim()] ?? null;
};

/* ── 영수증 옵션 라벨 조립 ─────────────────────────────────
 *   그룹명 있음 + 그룹명 ≠ 옵션명 → "온도: ICE"   (qty>1 이면 " x2" 접미)
 *   그룹명 있음 + 그룹명 = 옵션명 → "샷 추가: x2" (qty 1 이면 "샷 추가")
 *   그룹명 없음(미등록)           → "ICE"         (qty>1 이면 " x2")     */
export const buildOptionLabel = (opName, qty = 1) => {
    const og = resolveOptionGroupName(opName);
    const n = qty ?? 1;

    if (!og) return n > 1 ? `${opName} x${n}` : `${opName}`;
    if (og === opName) return n > 1 ? `${og}: x${n}` : `${og}`;
    return n > 1 ? `${og}: ${opName} x${n}` : `${og}: ${opName}`;
};

export default resolveOptionGroupName;
