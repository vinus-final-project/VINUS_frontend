import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/navbar";
import { MAIN_TIME_LIMIT_SEC } from "../../constants";
import { formatKRW } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import useCart from "../../hooks/useCart";
import useMenu from "../../hooks/useMenu";
import useSession from "../../hooks/useSession";
import useOrder from "../../hooks/useOrder";
import "./orderDetail.css";

/* ──────────────────────────────────────────────────────────────
 * OrderDetail — 메뉴 상세 페이지 (backend 실시간 동기화)
 *
 * 페이지의 모든 상호작용(수량, 옵션 선택/스텝퍼)은 backend 로도 즉시
 * 반영한다 (POST /orders/quantity, /orders/option).
 *   - 증가/선택 계열은 backend 호출 O
 *   - 감소/해제 계열은 backend 명세에 없어 로컬만 반영
 *     (완료 시점 최종 상태를 backend가 신뢰)
 *
 * UI 렌더는 useSession.current_menu 우선.
 * ────────────────────────────────────────────────────────────── */

const DEFAULT_DESC = "원하시는 옵션을 선택한 뒤 장바구니에 담아주세요.";
const STEPPER_MAX = 10;

const groupWidget = (og) => {
  const name = og?.og_name || "";
  if (name.includes("샷") || name.includes("휘핑") || name.includes("펄")) {
    return "STEPPER_GROUP";
  }
  if (name.includes("시럽")) return "STEPPER_OPT";
  return "BUTTON";
};
const isStepper = (og) => groupWidget(og) !== "BUTTON";

export default function OrderDetail() {
  const navigate = useNavigate();
  const { menuId } = useParams();
  const { addItem } = useCart();
  const { getMenuDetail } = useMenu();
  const { current_menu, session_id, applySessionResponse } = useSession();
  const { setQuantity: apiSetQuantity, selectOption, completeOrder } = useOrder();

  // backend current_menu 우선, 없으면 GET /menus/{id} fallback
  const [menu, setMenu] = useState(current_menu);

  // 선택 상태
  const [selectedButtons, setSelectedButtons] = useState({}); // { [og_id]: [op_id] }
  const [stepperCounts, setStepperCounts] = useState({}); //   { [op_id]: count }
  const [openOptionalGroups, setOpenOptionalGroups] = useState({});
  const [quantity, setQuantity] = useState(1);

  // API 호출 진행 상태 — 중복 클릭 방지
  const [busy, setBusy] = useState(false);

  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useCountdown(MAIN_TIME_LIMIT_SEC, onTimeout);

  /* ── 메뉴 로드: current_menu 우선, 없으면 REST fallback ── */
  useEffect(() => {
    if (current_menu?.m_id) {
      setMenu(current_menu);
      return;
    }
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
  }, [menuId, current_menu]);

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
    Object.values(selectedButtons).forEach((opIds) => {
      opIds.forEach((opId) => {
        const found = findOp(opId);
        if (found) sum += found.op.op_price;
      });
    });
    Object.entries(stepperCounts).forEach(([opIdStr, count]) => {
      if (!count) return;
      const found = findOp(Number(opIdStr));
      if (found) sum += found.op.op_price * count;
    });
    return sum;
  }, [selectedButtons, stepperCounts, findOp]);

  const unitPrice = (menu?.m_price ?? 0) + optionPrice;
  const displayPrice = unitPrice * quantity;

  /* ── 핸들러 ──────────────────────────────────────────── */
  const handleHome = () => navigate("/");
  const handleCallStaff = () => alert("직원호출");

  /* selectOption backend 호출 도우미
   *   응답이 오면 applySessionResponse 로 상태 반영.
   *   실패 시엔 로컬 상태만 그대로 두고 console 로그.               */
  const callSelectOption = async (op_id) => {
    if (!session_id) return;
    setBusy(true);
    try {
      const res = await selectOption(session_id, op_id);
      if (res) applySessionResponse(res);
    } finally {
      setBusy(false);
    }
  };

  /* setQuantity backend 호출 도우미 */
  const callSetQuantity = async (nextQty) => {
    if (!session_id) return;
    setBusy(true);
    try {
      const res = await apiSetQuantity(session_id, nextQty);
      if (res) applySessionResponse(res);
    } finally {
      setBusy(false);
    }
  };

  /* 버튼(chip) 그룹
   *   - 선택 시: 로컬 반영 + POST /orders/option
   *   - 해제 시: 로컬만 반영 (backend 명세에 옵션 제거 없음)          */
  const toggleButtonOption = async (og, op) => {
    if (busy) return;
    const cur = selectedButtons[og.og_id] || [];
    const isSelected = cur.includes(op.op_id);

    if (isSelected) {
      // 해제 — 로컬만
      setSelectedButtons((prev) => ({
        ...prev,
        [og.og_id]: (prev[og.og_id] || []).filter((id) => id !== op.op_id),
      }));
      return;
    }

    // 선택 — 로컬 즉시 반영 후 backend 호출
    setSelectedButtons((prev) => {
      const c = prev[og.og_id] || [];
      if ((og.og_max ?? 1) <= 1) return { ...prev, [og.og_id]: [op.op_id] };
      if (c.length >= og.og_max) return prev;
      return { ...prev, [og.og_id]: [...c, op.op_id] };
    });
    await callSelectOption(op.op_id);
  };

  /* 스텝퍼 (STEPPER_OPT / STEPPER_GROUP 공통)
   *   - 증가: 로컬 +1 + POST /orders/option (매번 op_id 추가)
   *   - 감소: 로컬 -1 (backend 명세 없음)                                */
  const changeStepper = async (op_id, delta) => {
    if (busy) return;
    const cur = stepperCounts[op_id] || 0;
    const next = Math.max(0, Math.min(STEPPER_MAX, cur + delta));
    if (next === cur) return;

    setStepperCounts((prev) => ({ ...prev, [op_id]: next }));
    if (delta > 0) {
      await callSelectOption(op_id);
    }
  };

  const toggleOptionalGroup = (og_id) => {
    setOpenOptionalGroups((prev) => ({ ...prev, [og_id]: !prev[og_id] }));
  };

  /* 수량 스텝퍼 — 증감 모두 POST /orders/quantity 로 새 값 전달 */
  const handleQuantity = async (delta) => {
    if (busy) return;
    const next = Math.max(1, quantity + delta);
    if (next === quantity) return;
    setQuantity(next);
    await callSetQuantity(next);
  };

  const handleCancel = () => navigate("/order");

  const handleConfirm = async () => {
    if (!menu) return;

    // 필수 그룹 검증
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

    // 옵션 배열 구성 (orderMenuOptions 정합)
    const options = [];
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

    // 로컬 cart 반영
    addItem({
      m_id: menu.m_id,
      m_name: menu.m_name,
      m_price: menu.m_price,
      o_m_qty: quantity,
      options,
      unitPrice,
    });

    // backend에 담기 요청 — POST /orders/complete
    if (session_id) {
      const res = await completeOrder(session_id);
      if (res) applySessionResponse(res);
    }

    navigate("/order");
  };

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
              disabled={busy}
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
                disabled={busy}
                onClick={() => changeStepper(op.op_id, -1)}
                aria-label={`${op.op_name} 감소`}
              >
                −
              </button>
              <span className="step-count">{count}</span>
              <button
                className="step-btn"
                disabled={busy}
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
              disabled={busy}
              onClick={() => changeStepper(baseOp.op_id, -1)}
              aria-label={`${og.og_name} 감소`}
            >
              −
            </button>
            <span className="step-count">{count}</span>
            <button
              className="step-btn"
              disabled={busy}
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

  const groupSubtotal = (og) => {
    if (isStepper(og)) {
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
      <Navbar timer={seconds} onHome={handleHome} onCallStaff={handleCallStaff} />

      <main className="kiosk-scroll order-detail-scroll">
        <section className="info-card">
          <h1 className="info-name">{menu.m_name}</h1>
          <p className="info-desc">{menu.m_description || DEFAULT_DESC}</p>
          <p className="info-price">{formatKRW(displayPrice)}</p>
        </section>

        {requiredGroups.map((og) => (
          <section className="opt-card" key={og.og_id}>
            <h2 className="opt-title">{og.og_name}</h2>
            {renderGroupBody(og)}
          </section>
        ))}

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
                  <div className="acc-scroll-area">{renderGroupBody(og)}</div>
                  <div className="paid-total">
                    <span className="paid-total-label">합계</span>
                    <span className="paid-total-value">{formatKRW(subtotal)}</span>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        <div className="qty-row">
          <button
            className="qty-btn"
            disabled={busy}
            onClick={() => handleQuantity(-1)}
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="qty-count">{quantity}</span>
          <button
            className="qty-btn"
            disabled={busy}
            onClick={() => handleQuantity(1)}
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
      </main>

      <footer className="kiosk-footer order-detail-footer">
        <button className="bottom-btn bottom-btn--ghost" onClick={handleCancel}>
          취소
        </button>
        <button
          className="bottom-btn bottom-btn--accent"
          disabled={busy}
          onClick={handleConfirm}
        >
          선택 완료
        </button>
      </footer>
    </>
  );
}
