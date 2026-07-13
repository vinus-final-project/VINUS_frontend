import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/navbar";
import { formatKRW } from "../../utils/format";
import useSessionCountdown from "../../hooks/useSessionCountdown";
import useMenu from "../../hooks/useMenu";
import useSession from "../../hooks/useSession";
import useOrder from "../../hooks/useOrder";
import "./orderDetail.css";

/* ──────────────────────────────────────────────────────────────
 * OrderDetail — 메뉴 상세 페이지 (backend 실시간 동기화)
 *
 * 페이지의 모든 상호작용(수량, 옵션 선택/스텝퍼)은 backend 로도 즉시 반영.
 *   - 옵션 추가(+1)         → POST /orders/option        (SELECT_OPTION)
 *   - 옵션 해제/감소(-1)    → POST /orders/option/remove (DESELECT_OPTION)
 *   - 수량 지정             → POST /orders/quantity      (SET_QUANTITY)
 *
 * ※ backend /orders/option 은 토글이 아니라 add-only. 해제/감소는 명시적으로
 *   /orders/option/remove 를 호출해야 selected_options 에서 빠진다.
 *
 * UI 렌더는 useSession.current_menu 우선.
 * ────────────────────────────────────────────────────────────── */

const DEFAULT_DESC = "원하시는 옵션을 선택한 뒤 장바구니에 담아주세요.";

/* 옵션 그룹 위젯 분류 — og_name 매칭 (UI 원본 유지)
 *   샷/휘핑/펄 → STEPPER_GROUP  (그룹 대표 스텝퍼 하나)
 *   시럽       → STEPPER_OPT    (옵션별 스텝퍼)
 *   그 외      → BUTTON         (chip 토글)
 *
 * 필수/상한 판정은 og.og_required / og.og_min / og.og_max 로 분리 처리.       */
const groupWidget = (og) => {
  const name = og?.og_name || "";
  if (name.includes("샷") || name.includes("휘핑") || name.includes("펄")) {
    return "STEPPER_GROUP";
  }
  if (name.includes("시럽")) return "STEPPER_OPT";
  return "BUTTON";
};
const isStepper = (og) => groupWidget(og) !== "BUTTON";
const groupStepperTotal = (og, stepperCounts) =>
  (og?.options || []).reduce((s, op) => s + (stepperCounts[op.op_id] || 0), 0);

/* 아코디언 하단 '합계' 표시 여부 — 당도/얼음량은 전부 무료 옵션이라
 * 금액 합계 UI 가 무의미하므로 숨긴다. */
const showsSubtotal = (og) => !/당도|얼음량/.test(og?.og_name || "");

export default function OrderDetail() {
  const navigate = useNavigate();
  const { menuId } = useParams();
  const { getMenuDetail } = useMenu();
  const { current_menu, order_item, session_id, applySessionResponse } = useSession();
  const { setQuantity: apiSetQuantity, selectOption, deselectOption, cancelOrder, completeOrder } = useOrder();

  // backend current_menu 우선, 없으면 GET /menus/{id} fallback
  const [menu, setMenu] = useState(current_menu);

  // 선택 상태
  const [selectedButtons, setSelectedButtons] = useState({}); // { [og_id]: [op_id] }
  const [stepperCounts, setStepperCounts] = useState({}); //   { [op_id]: count }
  const [openOptionalGroups, setOpenOptionalGroups] = useState({});
  const [quantity, setQuantity] = useState(1);

  // API 호출 진행 상태 — 중복 클릭 방지
  const [busy, setBusy] = useState(false);

  // 세션 공유 카운트다운 (order/orderDetail/cart 공용)
  const onTimeout = useCallback(() => navigate("/"), [navigate]);
  const seconds = useSessionCountdown(onTimeout);

  /* order_item 소멸 감지 — 취소/제거 시 자동 /order 이동.
   *   초기 진입엔 order_item 이 null 일 수 있으므로 "한 번이라도 있었는가"
   *   플래그(hadItemRef)로 방어. 이후 다시 null 이 되면 그때 이동.         */
  const hadItemRef = useRef(false);
  useEffect(() => {
    // backend OrderItem 필드명은 menu_id (m_id 는 과거 호환)
    if (order_item?.menu_id ?? order_item?.m_id) {
      hadItemRef.current = true;
      return;
    }
    if (hadItemRef.current && !order_item) {
      hadItemRef.current = false; // 리셋
      navigate("/order");
    }
  }, [order_item, navigate]);

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

  /* ── 음성 변경 동기화 — backend order_item 이 진실의 원천 ──
   *    음성으로 옵션/수량이 바뀌면 SessionResponse.order_item 이 갱신되는데
   *    스텝퍼/칩/수량은 로컬 상태라 화면에 안 보이던 문제 해결.
   *    터치 조작 응답에도 같은 값이 재계산되므로 충돌 없음(서버 = 진실).   */
  useEffect(() => {
    if (!order_item) return;

    // 수량은 옵션 그룹 유무와 무관하게 항상 동기화
    //   (디저트류처럼 option_groups 가 빈 메뉴에서 수량 변경이
    //    화면에 반영되지 않던 문제 — 아래 옵션 동기화 가드보다 먼저)
    setQuantity(order_item.quantity ?? 1);

    if (optionGroups.length === 0) return;

    const sel = order_item.selected_options || {};
    const nextButtons = {};
    const nextSteppers = {};
    const openGroups = {};
    for (const [ogIdStr, opIds] of Object.entries(sel)) {
      const og = optionGroups.find((g) => String(g.og_id) === String(ogIdStr));
      if (!og || !Array.isArray(opIds)) continue;
      if ((og.og_max ?? 1) <= 1) {
        // 단일선택(칩) 그룹
        nextButtons[og.og_id] = opIds.slice(0, 1);
      } else {
        // 누적(스텝퍼) 그룹 — 같은 op_id 반복 = 개수
        for (const opId of opIds) {
          nextSteppers[opId] = (nextSteppers[opId] || 0) + 1;
        }
        if (opIds.length > 0 && !og.og_required) {
          openGroups[og.og_id] = true; // 선택된 그룹은 펼쳐서 보여주기
        }
      }
    }
    setSelectedButtons(nextButtons);
    setStepperCounts(nextSteppers);
    setOpenOptionalGroups((prev) => ({ ...prev, ...openGroups }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_item, optionGroups]);

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

  /* selectOption(+1) / deselectOption(-1) backend 호출 도우미
   *   응답이 오면 applySessionResponse 로 상태 반영.               */
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

  const callDeselectOption = async (op_id) => {
    if (!session_id) return;
    setBusy(true);
    try {
      const res = await deselectOption(session_id, op_id);
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
   *   - 이미 선택된 chip 재클릭 → DESELECT_OPTION (/orders/option/remove)
   *   - 새 chip 선택           → SELECT_OPTION   (/orders/option)
   *   단일선택(og_max=1) 그룹에서 다른 chip 클릭 시엔 backend가 자동 교체 하므로
   *   프론트는 이전 선택을 로컬에서만 지우고 새 op_id 로 SELECT_OPTION 만 호출.  */
  const toggleButtonOption = async (og, op) => {
    if (busy) return;
    const cur = selectedButtons[og.og_id] || [];
    const isSelected = cur.includes(op.op_id);
    const isSingle = (og.og_max ?? 1) <= 1;

    // 로컬 상태 즉시 반영 (optimistic)
    setSelectedButtons((prev) => {
      const c = prev[og.og_id] || [];
      if (isSelected) {
        return { ...prev, [og.og_id]: c.filter((id) => id !== op.op_id) };
      }
      if (isSingle) return { ...prev, [og.og_id]: [op.op_id] };
      if (c.length >= og.og_max) return prev;
      return { ...prev, [og.og_id]: [...c, op.op_id] };
    });

    // backend 호출 분기
    if (isSelected) {
      await callDeselectOption(op.op_id);
    } else {
      // 새 선택 — 단일선택 그룹은 backend가 이전 op 를 교체 처리
      await callSelectOption(op.op_id);
    }
  };

  /* 스텝퍼 (og_max >= 2 그룹)
   *   + 버튼 → SELECT_OPTION  (/orders/option)
   *   - 버튼 → DESELECT_OPTION(/orders/option/remove)
   *   상한: 그룹 내 모든 옵션 카운트의 합이 og.og_max 이하.                 */
  const changeStepper = async (og, op_id, delta) => {
    if (busy) return;
    const cur = stepperCounts[op_id] || 0;

    if (delta > 0) {
      // og_max 그룹 합계 상한 방어
      const groupTotal = groupStepperTotal(og, stepperCounts);
      if (groupTotal >= (og.og_max ?? 1)) return;
    } else if (cur <= 0) {
      return;
    }

    const next = cur + delta;
    // 로컬 즉시 반영 (optimistic)
    setStepperCounts((prev) => ({ ...prev, [op_id]: next }));

    // +/- 에 따라 backend endpoint 분기
    if (delta > 0) {
      await callSelectOption(op_id);
    } else {
      await callDeselectOption(op_id);
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

  /* 취소 버튼 — backend CANCEL_ORDER_ITEM 호출 후 /order 로 복귀.
   *   session이 있을 때만 호출(직접 진입 등 방어).                         */
  const handleCancel = async () => {
    if (session_id) {
      const res = await cancelOrder(session_id);
      if (res) applySessionResponse(res);
    }
    navigate("/order");
  };

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

    /* backend 검증 우선 — POST /orders/complete
     *   응답 SessionResponse.cart 로 로컬 items 가 자동 반영됨(useCart 는
     *   session.cart 파생). response_type === "ERROR" 이면 alert 후 return. */
    if (!session_id) {
      alert("세션이 만료되었습니다. 처음부터 다시 시도해주세요.");
      navigate("/");
      return;
    }

    setBusy(true);
    let res = null;
    try {
      res = await completeOrder(session_id);
    } finally {
      setBusy(false);
    }
    if (!res) {
      alert("장바구니 담기에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (res.response_type === "ERROR") {
      const msg = res.message || res.error_code || "장바구니에 담을 수 없습니다.";
      alert(msg);
      applySessionResponse(res);
      return;
    }
    applySessionResponse(res);
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

  /* 옵션별 스텝퍼 (시럽 처럼 그룹 내 옵션이 여러 개)
   *   그룹 합계 상한 = og.og_max. 도달 시 그룹 내 모든 + 버튼 disabled.     */
  const renderOptStepperBody = (og) => {
    const groupTotal = groupStepperTotal(og, stepperCounts);
    const canAdd = groupTotal < (og.og_max ?? 1);
    return (
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
                  disabled={busy || count <= 0}
                  onClick={() => changeStepper(og, op.op_id, -1)}
                  aria-label={`${op.op_name} 감소`}
                >
                  −
                </button>
                <span className="step-count">{count}</span>
                <button
                  className="step-btn"
                  disabled={busy || !canAdd}
                  onClick={() => changeStepper(og, op.op_id, 1)}
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
  };

  /* 그룹 대표 스텝퍼 (샷/휘핑/펄 처럼 그룹 대표 하나만 표시)
   *   상한 = og.og_max (baseOp 카운트 기준).                                */
  const renderGroupStepperBody = (og) => {
    const baseOp = og.options?.[0];
    if (!baseOp) return null;
    const count = stepperCounts[baseOp.op_id] || 0;
    const canAdd = count < (og.og_max ?? 1);
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
              disabled={busy || count <= 0}
              onClick={() => changeStepper(og, baseOp.op_id, -1)}
              aria-label={`${og.og_name} 감소`}
            >
              −
            </button>
            <span className="step-count">{count}</span>
            <button
              className="step-btn"
              disabled={busy || !canAdd}
              onClick={() => changeStepper(og, baseOp.op_id, 1)}
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
                  {/* 당도/얼음량(무료 옵션 그룹)은 합계 UI 제거 */}
                  {showsSubtotal(og) && (
                    <div className="paid-total">
                      <span className="paid-total-label">합계</span>
                      <span className="paid-total-value">{formatKRW(subtotal)}</span>
                    </div>
                  )}
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
