/* ==========================================================================
   weekly.js — Weekly Planner (Mon–Sun)
   Reads the SAME tasks/events data used everywhere else in the app — no
   separate task/event system. Completing a task here updates it everywhere.
   ========================================================================== */

const MS_WEEKLY_DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

let msWeeklyWeekStart = null; // Date, always a Monday

function msWeeklyInit() {
  msWeeklyWeekStart = msStartOfWeek(msToday());
  msRenderWeekly();
}

function msWeeklyPrev() {
  const d = new Date(msWeeklyWeekStart);
  d.setDate(d.getDate() - 7);
  msWeeklyWeekStart = d;
  msRenderWeekly();
}

function msWeeklyNext() {
  const d = new Date(msWeeklyWeekStart);
  d.setDate(d.getDate() + 7);
  msWeeklyWeekStart = d;
  msRenderWeekly();
}

function msWeeklyToday() {
  msWeeklyWeekStart = msStartOfWeek(msToday());
  msRenderWeekly();
}

function msWeeklyWeekEnd() {
  const d = new Date(msWeeklyWeekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function msWeekLabelParts(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const todayWeekStart = msStartOfWeek(msToday());
  const isCurrent = msDateStr(start) === msDateStr(todayWeekStart);
  const monthDay = d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return {
    weekLabel: isCurrent ? "This Week" : `Week of ${monthDay(start)}`,
    rangeLabel: `${monthDay(start)} – ${monthDay(end)}, ${end.getFullYear()}`
  };
}

function msRenderWeekly() {
  const { weekLabel, rangeLabel } = msWeekLabelParts(msWeeklyWeekStart);
  document.getElementById("weeklyWeekLabel").textContent = weekLabel;
  document.getElementById("weeklyDateRange").textContent = rangeLabel;
  msRenderWeeklyGrid();
  msRenderPriorities();
  msRenderWeeklyNotes();
}

function msFormatMinutes(mins) {
  if (!mins) return "";
  return mins >= 60 ? (mins / 60).toFixed(mins % 60 === 0 ? 0 : 1) + " hr" : mins + " min";
}

function msRenderWeeklyGrid() {
  const start = msWeeklyWeekStart;
  const todayStr = msDateStr(msToday());
  const tasks = msGetTasks();
  const events = msGetEvents();
  let totalTasksWeek = 0, doneTasksWeek = 0;

  let html = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = msDateStr(d);
    const isToday = ds === todayStr;

    const dayTasks = tasks.filter(t => t.dueDate === ds).sort((a, b) => Number(a.completed) - Number(b.completed));
    const dayEvents = events.filter(e => e.date === ds).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const doneCount = dayTasks.filter(t => t.completed).length;
    totalTasksWeek += dayTasks.length;
    doneTasksWeek += doneCount;
    const estMinutes = dayTasks.reduce((sum, t) => sum + (t.estMinutes || 0), 0);

    let itemsHtml;
    if (dayTasks.length === 0 && dayEvents.length === 0) {
      itemsHtml = `<div class="weekly-empty small text-faint">Nothing scheduled</div>`;
    } else {
      const taskRows = dayTasks.map(t => {
        const subject = msGetSubjectById(t.subjectId);
        return `
          <div class="weekly-item">
            <button class="task-check ${t.completed ? "done" : ""}" onclick="msWeeklyToggleTask('${t.id}')" aria-label="Toggle complete">
              <i class="bi bi-check2"></i>
            </button>
            <div class="flex-grow-1 min-w-0">
              <div class="weekly-item-title ${t.completed ? "text-decoration-line-through text-faint" : ""}">${msEscapeHtml(t.title)}</div>
              <div class="weekly-item-meta">${subject ? msEscapeHtml(subject.name) + " · " : ""}${msFormatMinutes(t.estMinutes)}</div>
            </div>
          </div>`;
      }).join("");
      const eventRows = dayEvents.map(e => {
        const subject = msGetSubjectById(e.subjectId);
        return `
          <div class="weekly-item">
            <span class="cal-event type-${e.type.toLowerCase()}" style="flex-shrink:0;">${msEscapeHtml(e.type)}</span>
            <div class="flex-grow-1 min-w-0">
              <div class="weekly-item-title">${msEscapeHtml(e.title)}</div>
              <div class="weekly-item-meta">${subject ? msEscapeHtml(subject.name) + " · " : ""}${e.time ? e.time : "All day"}</div>
            </div>
          </div>`;
      }).join("");
      itemsHtml = taskRows + eventRows;
    }

    const completeTag = dayTasks.length === 0
      ? `<span class="tag tag-neutral">No tasks</span>`
      : `<span class="tag ${doneCount === dayTasks.length ? "tag-low" : "tag-neutral"}">${doneCount}/${dayTasks.length} done</span>`;

    html += `
      <div class="weekly-day-card ${isToday ? "is-today" : ""}">
        <div class="weekly-day-head">
          <div>
            <div class="wd-name">${MS_WEEKLY_DOW[i]}</div>
            <div class="wd-date">${d.getDate()}</div>
          </div>
          <div class="weekly-day-stats">
            ${completeTag}
            <span class="small text-faint mt-1">${estMinutes ? msFormatMinutes(estMinutes) + " study" : "—"}</span>
          </div>
        </div>
        <div class="weekly-day-items">${itemsHtml}</div>
      </div>`;
  }

  document.getElementById("weeklyGrid").innerHTML = html;
  document.getElementById("weeklyCompletionSummary").textContent = totalTasksWeek
    ? `${doneTasksWeek} / ${totalTasksWeek} tasks done this week`
    : "No tasks this week";
}

function msWeeklyToggleTask(id) {
  updateData(MS_KEYS.tasks, list => list.map(t => t.id === id
    ? { ...t, completed: !t.completed, completedDate: !t.completed ? msDateStr(msToday()) : null }
    : t), []);
  msRenderWeekly();
}

/* ---------- Top 3 priorities ---------- */

function msWeekTasksInRange() {
  const start = msWeeklyWeekStart;
  const end = msWeeklyWeekEnd();
  return msGetTasks()
    .filter(t => {
      const d = msParseDate(t.dueDate);
      return d >= start && d <= end;
    })
    .sort((a, b) => msParseDate(a.dueDate) - msParseDate(b.dueDate));
}

function msRenderPriorities() {
  const weekKey = msDateStr(msWeeklyWeekStart);
  const priorities = msGetWeeklyPriorities();
  const selected = priorities[weekKey] || [];
  const tasks = msWeekTasksInRange();
  const list = document.getElementById("weeklyPriorityList");

  document.getElementById("weeklyPriorityCount").textContent = `${selected.length} / 3 selected`;

  if (tasks.length === 0) {
    list.innerHTML = msEmptyStateHtml("bi-stars", "No tasks this week", "Tasks due this week will appear here so you can pick your top 3.", null);
    return;
  }

  list.innerHTML = tasks.map(t => {
    const subject = msGetSubjectById(t.subjectId);
    const isSelected = selected.includes(t.id);
    return `
      <div class="d-flex align-items-center gap-2 py-2">
        <button class="task-check ${isSelected ? "done" : ""}" onclick="msTogglePriority('${t.id}')" aria-label="Toggle priority">
          <i class="bi ${isSelected ? "bi-star-fill" : "bi-check2"}"></i>
        </button>
        <div class="flex-grow-1">
          <div class="small fw-semibold ${t.completed ? "text-decoration-line-through text-faint" : ""}">${msEscapeHtml(t.title)}${subject ? " — " + msEscapeHtml(subject.name) : ""}</div>
          <div class="row-meta">${msFormatShort(t.dueDate)}</div>
        </div>
      </div>`;
  }).join("");
}

function msTogglePriority(taskId) {
  const weekKey = msDateStr(msWeeklyWeekStart);
  const priorities = msGetWeeklyPriorities();
  let selected = priorities[weekKey] || [];
  if (selected.includes(taskId)) {
    selected = selected.filter(id => id !== taskId);
  } else {
    if (selected.length >= 3) {
      msToast("You can only pick up to 3 priorities.", "bi-exclamation-circle");
      return;
    }
    selected = [...selected, taskId];
  }
  updateData(MS_KEYS.weeklyPriorities, p => ({ ...p, [weekKey]: selected }), {});
  msRenderPriorities();
}

/* ---------- Weekly notes ---------- */

function msRenderWeeklyNotes() {
  const weekKey = msDateStr(msWeeklyWeekStart);
  const notes = msGetWeeklyNotes();
  document.getElementById("weeklyNotesArea").value = notes[weekKey] || "";
}

function msSaveWeeklyNote() {
  const weekKey = msDateStr(msWeeklyWeekStart);
  const val = document.getElementById("weeklyNotesArea").value;
  updateData(MS_KEYS.weeklyNotes, notes => ({ ...notes, [weekKey]: val }), {});
  msToast("Weekly note saved", "bi-check-circle");
}
