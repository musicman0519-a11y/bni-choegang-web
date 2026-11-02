(() => {
  // ── 일정 설정 ──────────────────────────────────────────
  // 매주 이 요일에 "조찬회의"가 자동 표시됩니다. (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
  const MEETING_WEEKDAY = 3;
  // 특정 날짜만 다르게 표시하려면 여기에 추가하세요.
  // type: "meeting"(조찬회의) · "online"(화상회의) · "off"(회의없음) · "event"(행사)
  // 예) "2026-12-30": { type: "off", label: "회의없음", note: "연말 휴회" },
  const SCHEDULE_OVERRIDES = {
  };
  // ──────────────────────────────────────────────────────

  const root = document.querySelector("#meetingCalendar");
  if (!root) return;
  const title = root.querySelector(".calendar-title");
  const grid = root.querySelector(".calendar-grid");
  const pad = (n) => String(n).padStart(2, "0");
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();

  // 어드민에서 등록한 일정이 있으면 함께 반영합니다.
  const overrides = { ...SCHEDULE_OVERRIDES, ...(window.siteSchedule || {}) };
  const entryFor = (date) => {
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (overrides[key]) return overrides[key];
    if (date.getDay() === MEETING_WEEKDAY) return { type: "meeting", label: "조찬회의" };
    return null;
  };

  const render = () => {
    title.textContent = `${viewYear}년 ${viewMonth + 1}월`;
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-cell is-empty" aria-hidden="true"></div>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(viewYear, viewMonth, day);
      const entry = entryFor(date);
      const weekday = date.getDay();
      const classes = ["calendar-cell"];
      if (weekday === 0) classes.push("is-sun");
      if (weekday === 6) classes.push("is-sat");
      if (entry) classes.push("has-event", `type-${entry.type}`);
      if (date.toDateString() === today.toDateString()) classes.push("is-today");
      cells.push(`<div class="${classes.join(" ")}">
        <span class="calendar-day">${day}</span>
        ${entry ? `<span class="calendar-badge">${entry.label}</span>` : ""}
        ${entry?.note ? `<small class="calendar-note">${entry.note}</small>` : ""}
      </div>`);
    }
    grid.innerHTML = cells.join("");
  };

  root.querySelector(".calendar-prev").addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  });
  root.querySelector(".calendar-next").addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  });
  render();
})();
