import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/navbar";
import { MAIN_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import useMenu from "../../hooks/useMenu";
import "./orderDetail.css";

/* ──────────────────────────────────────────────────────────────
 * OrderDetail — 메뉴 상세 페이지
 *
 * GET /menus/{m_id} 응답의 option_groups 를 UI로 완전 동적 렌더링.
 *
 * UI 결정 규칙
 *   ① 컨테이너 (og_required)
 *        true  → 옵션박스(.opt-card), 항상 펼침
 *        false → 아코디언(.acc), 토글
 *
 *   ② 위젯 (og_name) — 3분류
 *        "샷" / "휘핑" / "펄" 포함 → 그룹당 스텝퍼 1개
 *                                    (options[0] 기준, 나머지 무시)
 *        "시럽" 포함              → 옵션마다 스텝퍼
 *        그 외(온도/당도/얼음량/  → 버튼(chip) 다중선택
 *              사이즈 등)            (사이즈는 chip 안에 op_price 표시)
 *
 *   ③ 선택 개수 제한
 *        스텝퍼 → 0 ~ STEPPER_MAX(=10)
 *        버튼   → 그룹 내 최대 og_max 개
 *
 * cart 담기 매핑 (backend orderMenuOptions 정합)
 *   options: [{ op_id, op_name, op_price, og_id, og_name }, ...]
 *   - 버튼:   선택된 op_id 마다 1건
 *   - 스텝퍼: op 별 count 만큼 반복 push (op_id 개별 저장)
 *
 * 상단 정보 카드의 가격
 *   - m_price 고정이 아니라 unitPrice × quantity 로 실시간 갱신
 * ────────────────────────────────────────────────────────────── */

const DEFAULT_DESC = "원하시는 옵션을 선택한 뒤 장바구니에 담아주세요.";
const STEPPER_MAX = 10;

// 위젯 유형: BUTTON / STEPPER_OPT(옵션마다) / STEPPER_GROUP(그룹당 1개)
const groupWidget = (og) => {
  const name = og?.og_name || "";
  if (name.includes("샷") || name.includes("휘핑") || name.includes("펄")) {
    return "STEPPER_GROUP";
  }
  if (name.includes("시럽")) return "STEPPER_OPT";
  return "BUTTON";
};
// 스텝퍼 유형 판별 도우미 (필수 검증/소계 계산 공통)
const isStepper = (og) => groupWidget(og) !== "BUTTON";

export default function OrderDetail() {
  const navigate = useNavigate();
  const { menuId } = useParams();
  const { addItem } = useCart();
  const { getMenuDetail } = useMenu();

  const [menu, setMenu] = useState(null);

  // 선택 상태
  //   버튼:   { [og_id]: [op_id, ...] }
  //   스텝퍼: { [op_id]: count }             — 옵션별 count
  const [selectedButtons, setSelectedButtons] = useState({});
  const [stepperCounts, setStepperCounts] = useState({});
  const [openOptionalGroups, setOpenOptionalGroups] = useState({});
  const [quantity, setQuantity] = useState(1);

  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(MAIN_TIME_LIMIT_SEC, onTimeout);

  /* ── 마운트: GET /menus/{m_id} ────────────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await getMenuDetail(menuId);
      if (!alive || !d) return;
      setMenu(d);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  /* ── 그룹 분리 & 도우미 ─────────────────────────────── */
  const optionGroups = menu?.option_groups || [];
  const requiredGroups = optionGroups.filter((og) => og.og_required);
  const optionalGroups = optionGroups.filter((og) => !og.og_required);

  const findOp = useCallback(
    (opId) => {
      for (const og of optionGroups) {
        const op = og.options?.find((o) => o.op_id === opId);
        if (op) return { op, og };
      }
      return null;
    },
    [optionGroups]
  );

  /* ── 가격 계산 ───────────────────────────────────────── */
  const optionPrice = useMemo(() => {
    let sum = 0;
    // 버튼: 선택된 op 마다 price
    Object.values(selectedButtons).forEach((opIds) => {
      opIds.forEach((opId) => {
        const found = findOp(opId);
        if (found) sum += found.op.op_price;
      });
    });
    // 스텝퍼: op 별 count 만큼 price 누적
    Object.entries(stepperCounts).forEach(([opIdStr, count]) => {
      if (!count) return;
      const found = findOp(Number(opIdStr));
      if (found) sum += found.op.op_price * count;
    });
    return sum;
  }, [selectedButtons, stepperCounts, findOp]);

  const unitPrice = (menu?.m_price ?? 0) + optionPrice;
  const displayPrice = unitPrice * quantity; // 상단 info-price 에 실시간 반영

  /* ── 핸들러 ──────────────────────────────────────────── */
  const handleHome = () => navigate("/");
  const handleCallStaff = () => {
    alert("직원호출");
    // TODO: 직원호출 API 요청
  };

  const toggleButtonOption = (og, op) => {
    setSelectedButtons((prev) => {
      const cur = prev[og.og_id] || [];
      if (cur.includes(op.op_id)) {
        return { ...prev, [og.og_id]: cur.filter((id) => id !== op.op_id) };
      }
      if ((og.og_max ?? 1) <= 1) {
        return { ...prev, [og.og_id]: [op.op_id] };
      }
      if (cur.length >= og.og_max) {
        return prev;
      }
      return { ...prev, [og.og_id]: [...cur, op.op_id] };
    });
  };

  // 스텝퍼: op 별 count 조작 (옵션마다 개별)
  const changeStepper = (op_id, delta) => {
    setStepperCounts((prev) => {
      const cur = prev[op_id] || 0;
      return { ...prev, [op_id]: Math.max(0, Math.min(STEPPER_MAX, cur + delta)) };
    });
  };

  const toggleOptionalGroup = (og_id) => {
    setOpenOptionalGroups((prev) => ({ ...prev, [og_id]: !prev[og_id] }));
  };

  const handleQuantity = (delta) => {
    setQuantity((q) => Math.max(1, q + delta));
  };

  const handleCancel = () => navigate("/order");

  const handleConfirm = () => {
    if (!menu) return;

    /* 필수 그룹 검증
     *   버튼:   선택된 개수 >= og_min
     *   스텝퍼: 그룹 내 op 카운트 합 >= og_min                            */
    for (const og of requiredGroups) {
      const min = og.og_min || 1;
      if (isStepper(og)) {
        const total = (og.options || []).reduce(
          (s, op) => s + (stepperCounts[op.op_id] || 0),
          0
        );
        if (total < min) {
          alert(`'${og.og_name}' 을(를) 최소 ${min}개 선택해주세요.`);
          return;
        }
      } else {
        const cur = selectedButtons[og.og_id] || [];
        if (cur.length < min) {
          alert(`'${og.og_name}' 을(를) 선택해주세요.`);
          return;
        }
      }
    }

    // 옵션 배열 구성 (orderMenuOptions 스키마 정합)
    const options = [];

    // 버튼 그룹
    Object.values(selectedButtons).forEach((opIds) => {
      opIds.forEach((opId) => {
        const found = findOp(opId);
        if (!found) return;
        options.push({
          op_id: found.op.op_id,
          op_name: found.op.op_name,
          op_price: found.op.op_price,
          og_id: found.og.og_id,
          og_name: found.og.og_name,
        });
      });
    });

    // 스텝퍼 그룹 — 각 op 를 count 번 반복
    Object.entries(stepperCounts).forEach(([opIdStr, count]) => {
      if (!count) return;
      const found = findOp(Number(opIdStr));
      if (!found) return;
      for (let i = 0; i < count; i += 1) {
        options.push({
          op_id: found.op.op_id,
          op_name: found.op.op_name,
          op_price: found.op.op_price,
          og_id: found.og.og_id,
          og_name: found.og.og_name,
        });
      }
    });

    addItem({
      m_id: menu.m_id,
      m_name: menu.m_name,
      m_price: menu.m_price,
      o_m_qty: quantity,
      options,
      unitPrice,
    });

    navigate("/order");
  };

  /* ── 로딩 상태 ───────────────────────────────────────── */
  if (!menu) {
    return (
      <>
        <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />
        <main className="kiosk-scroll order-detail-scroll">
          <section className="info-card">
            <p className="info-desc">메뉴 정보를 불러오는 중입니다…</p>
          </section>
        </main>
      </>
    );
  }

  /* ── 렌더 헬퍼 ───────────────────────────────────────── */
  // 버튼(chip) 그룹 본문 — og.options 만 (선택 안 함 chip 없음)
  const renderButtonBody = (og) => {
    const cur = selectedButtons[og.og_id] || [];
    return (
      <div className="chip-row">
        {(og.options || []).map((op) => {
          const isActive = cur.includes(op.op_id);
          return (
            <button
              key={op.op_id}
              className={`chip ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
              onClick={() => toggleButtonOption(og, op)}
            >
              {op.op_name}
              {op.op_price > 0 && ` +${formatKRW(op.op_price)}`}
            </button>
          );
        })}
      </div>
    );
  };

  // STEPPER_OPT: 옵션마다 이름/가격 + 개별 스텝퍼 (예: 시럽 추가)
  const renderOptStepperBody = (og) => (
    <div className="acc-scroll-list">
      {(og.options || []).map((op, idx) => {
        const count = stepperCounts[op.op_id] || 0;
        return (
          <div className="paid-item" key={op.op_id}>
            <div className="paid-item-top">
              <span className="paid-name">{op.op_name}</span>
              <span className="paid-price">{formatKRW(op.op_price)}</span>
            </div>
            <div className="stepper">
              <button
                className="step-btn"
                onClick={() => changeStepper(op.op_id, -1)}
                aria-label={`${op.op_name} 감소`}
              >
                −
              </button>
              <span className="step-count">{count}</span>
              <button
                className="step-btn"
                onClick={() => changeStepper(op.op_id, 1)}
                aria-label={`${op.op_name} 증가`}
              >
                +
              </button>
            </div>
            {idx < (og.options.length - 1) && <hr className="opt-divider" />}
          </div>
        );
      })}
    </div>
  );

  // STEPPER_GROUP: 그룹당 스텝퍼 하나 (options[0] 만 사용, 나머지 무시)
  //   예: 샷 추가 / 휘핑 추가 / 펄 추가
  //   ※ STEPPER_OPT 와 동일 구조(.acc-scroll-list > .paid-item)로 감싸서
  //     아코디언 안에서 폭 100% 확보 → 가격이 우측 끝까지 밀림
  const renderGroupStepperBody = (og) => {
    const baseOp = og.options?.[0];
    if (!baseOp) return null;
    const count = stepperCounts[baseOp.op_id] || 0;
    return (
      <div className="acc-scroll-list">
        <div className="paid-item">
          <div className="paid-item-top">
            <span className="paid-name">{og.og_name}</span>
            <span className="paid-price">{formatKRW(baseOp.op_price)}</span>
          </div>
          <div className="stepper">
            <button
              className="step-btn"
              onClick={() => changeStepper(baseOp.op_id, -1)}
              aria-label={`${og.og_name} 감소`}
            >
              −
            </button>
            <span className="step-count">{count}</span>
            <button
              className="step-btn"
              onClick={() => changeStepper(baseOp.op_id, 1)}
              aria-label={`${og.og_name} 증가`}
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 위젯 유형에 따라 본문 분기
  const renderGroupBody = (og) => {
    switch (groupWidget(og)) {
      case "STEPPER_OPT":
        return renderOptStepperBody(og);
      case "STEPPER_GROUP":
        return renderGroupStepperBody(og);
      case "BUTTON":
      default:
        return renderButtonBody(og);
    }
  };

  // 그룹 소계 (아코디언 하단 표시용)
  const groupSubtotal = (og) => {
    if (isStepper(og)) {
      // STEPPER_OPT / STEPPER_GROUP 모두 stepperCounts 를 op_id 기준으로 사용
      return (og.options || []).reduce(
        (s, op) => s + op.op_price * (stepperCounts[op.op_id] || 0),
        0
      );
    }
    return (selectedButtons[og.og_id] || []).reduce((s, opId) => {
      const f = findOp(opId);
      return s + (f ? f.op.op_price : 0);
    }, 0);
  };

  return (
    <>
      {/* 상단 네비게이션 */}
      <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />

      {/* ── 스크롤 영역 ───────────────────────────────────── */}
      <main className="kiosk-scroll order-detail-scroll">
        {/* 정보 카드 — 가격은 unitPrice × quantity 로 실시간 갱신 */}
        <section className="info-card">
          <h1 className="info-name">{menu.m_name}</h1>
          <p className="info-desc">{menu.m_description || DEFAULT_DESC}</p>
          <p className="info-price">{formatKRW(displayPrice)}</p>
        </section>

        {/* 필수 그룹 — .opt-card 항상 펼침 */}
        {requiredGroups.map((og) => (
          <section className="opt-card" key={og.og_id}>
            <h2 className="opt-title">{og.og_name}</h2>
            {renderGroupBody(og)}
          </section>
        ))}

        {/* 선택 그룹 — 아코디언 */}
        {optionalGroups.map((og) => {
          const isOpen = !!openOptionalGroups[og.og_id];
          const subtotal = groupSubtotal(og);
          return (
            <section className={`acc ${isOpen ? "is-open" : ""}`} key={og.og_id}>
              <button
                className="acc-head"
                onClick={() => toggleOptionalGroup(og.og_id)}
                aria-expanded={isOpen}
              >
                <span className="acc-title">{og.og_name}</span>
                <span className="acc-toggle">{isOpen ? "접기 ▲" : "자세히 ▼"}</span>
              </button>

              {isOpen && (
                <div className="acc-body">
                  <div className="acc-scroll-area">
                    {renderGroupBody(og)}
                  </div>
                  <div className="paid-total">
                    <span className="paid-total-label">합계</span>
                    <span className="paid-total-value">{formatKRW(subtotal)}</span>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {/* 수량 */}
        <div className="qty-row">
          <button
            className="qty-btn"
            onClick={() => handleQuantity(-1)}
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="qty-count">{quantity}</span>
          <button
            className="qty-btn"
            onClick={() => handleQuantity(1)}
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
      </main>

      {/* ── 하단 푸터 ───────────────────────────────────── */}
      <footer className="kiosk-footer order-detail-footer">
        <button className="bottom-btn bottom-btn--ghost" onClick={handleCancel}>
          취소
        </button>
        <button className="bottom-btn bottom-btn--accent" onClick={handleConfirm}>
          선택 완료
        </button>
      </footer>
    </>
  );
}
