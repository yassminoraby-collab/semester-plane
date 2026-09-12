/* ==========================================================================
   main.js — app chrome (sidebar/nav), theme, toast, dashboard rendering
   ========================================================================== */

const MS_NAV_ITEMS = [
  { id: "home", label: "Home", icon: "bi-house", href: "index.html" },
  { id: "calendar", label: "Calendar", icon: "bi-calendar3", href: "calendar.html" },
  { id: "weekly", label: "Weekly Planner", icon: "bi-calendar-week", href: "weekly.html" },
  { id: "subjects", label: "Subjects", icon: "bi-journal-bookmark", href: "subjects.html" },
  { id: "tasks", label: "Tasks", icon: "bi-check2-square", href: "tasks.html" },
  { id: "grades", label: "Grades", icon: "bi-mortarboard", href: "grades.html" },
  { id: "goals", label: "Goals", icon: "bi-flag", href: "goals.html" },
  { id: "progress", label: "Progress", icon: "bi-graph-up", href: "progress.html" },
  { id: "settings", label: "Settings", icon: "bi-gear", href: "settings.html" }
];

const MS_SPRIG_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 22V10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M12 14C12 14 6 13 6 7C12 7 12 14 12 14Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M12 10C12 10 18 9 18 3C12 3 12 10 12 10Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

const MS_BRAND_SVG = `<svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="17" cy="17" r="16" stroke="currentColor" stroke-width="1.3"/>
  <path d="M17 25V15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M17 18C17 18 11.5 17 11.5 11C17 11 17 18 17 18Z" stroke="currentColor" stroke-width="1.3"/>
  <path d="M17 15C17 15 22.5 14 22.5 8C17 8 17 15 17 15Z" stroke="currentColor" stroke-width="1.3"/>
</svg>`;

function msNavListHtml(activeId) {
  return MS_NAV_ITEMS.map(item => `
    <li>
      <a class="nav-link ${item.id === activeId ? "active" : ""}" href="${item.href}">
        <i class="bi ${item.icon}"></i><span>${item.label}</span>
      </a>
    </li>`).join("");
}

function msInitChrome(activeId) {
  msSeedIfNeeded();
  msMigrateGradesToWeighted();
  const settings = msGetSettings();
  msApplyTheme(settings.theme);

  const initials = (settings.studentName || "Y").trim().charAt(0).toUpperCase();

  // Desktop sidebar
  const sidebarSlot = document.getElementById("sidebarSlot");
  if (sidebarSlot) {
    sidebarSlot.innerHTML = `
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">${MS_BRAND_SVG}</span>
          <span class="brand-name">My Semester<span class="accent"> ✦</span></span>
        </div>
        <ul class="nav-list">${msNavListHtml(activeId)}</ul>
        <div class="sidebar-footer">
          <div class="semester-chip">
            <strong>${settings.semesterName}</strong>
            Target GPA ${Number(settings.targetGPA).toFixed(1)}
          </div>
          <div class="profile-row">
            <div class="profile-avatar">${initials}</div>
            <div>
              <div class="profile-name">${settings.studentName}</div>
              <div class="profile-role">Student</div>
            </div>
          </div>
          <div class="footnote-sprig">${MS_SPRIG_SVG}<span>A little progress each day adds up to big results.</span></div>
        </div>
      </aside>`;
  }

  // Mobile topbar + offcanvas
  const topbarSlot = document.getElementById("topbarSlot");
  if (topbarSlot) {
    topbarSlot.innerHTML = `
      <header class="topbar-mobile">
        <button class="hamburger-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#msOffcanvas" aria-label="Open navigation">
          <i class="bi bi-list"></i>
        </button>
        <div class="brand">
          <span class="brand-mark">${MS_BRAND_SVG}</span>
          <span class="brand-name">My Semester</span>
        </div>
        <div class="profile-avatar" style="width:32px;height:32px;font-size:.85rem;">${initials}</div>
      </header>
      <div class="offcanvas offcanvas-start" tabindex="-1" id="msOffcanvas">
        <div class="offcanvas-header">
          <span class="brand"><span class="brand-mark">${MS_BRAND_SVG}</span><span class="brand-name">My Semester</span></span>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <aside class="sidebar">
            <ul class="nav-list">${msNavListHtml(activeId)}</ul>
            <div class="sidebar-footer">
              <div class="semester-chip"><strong>${settings.semesterName}</strong>Target GPA ${Number(settings.targetGPA).toFixed(1)}</div>
              <div class="profile-row">
                <div class="profile-avatar">${initials}</div>
                <div>
                  <div class="profile-name">${settings.studentName}</div>
                  <div class="profile-role">Student</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>`;
  }
}

function msApplyTheme(theme) {
  if (theme === "dusk") {
    document.documentElement.setAttribute("data-theme", "dusk");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function msGreetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function msTodayLongStr() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

let msToastTimer = null;
function msToast(message, icon) {
  let el = document.querySelector(".ms-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "ms-toast";
    document.body.appendChild(el);
  }
  el.innerHTML = `<i class="bi ${icon || "bi-check-circle"}"></i><span>${message}</span>`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(msToastTimer);
  msToastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function msEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function msPriorityTagClass(priority) {
  if (priority === "High") return "tag-high";
  if (priority === "Medium") return "tag-medium";
  return "tag-low";
}

/* ==========================================================================
   Dashboard (index.html)
   ========================================================================== */

function msDashboardDeadlines() {
  const today = msToday();
  const tasks = msGetTasks().filter(t => !t.completed).map(t => ({
    id: t.id, title: t.title, subjectId: t.subjectId, type: t.type,
    date: t.dueDate, priority: t.priority, kind: "task"
  }));
  const events = msGetEvents().map(e => ({
    id: e.id, title: e.title, subjectId: e.subjectId, type: e.type,
    date: e.date, priority: e.priority, kind: "event"
  }));
  const all = [...tasks, ...events]
    .map(item => ({ ...item, days: msDaysBetween(today, msParseDate(item.date)) }))
    // tasks keep showing once overdue (actionable); events only while upcoming/today
    .filter(item => item.kind === "task" ? item.days >= -14 : item.days >= 0)
    .sort((a, b) => a.days - b.days);
  return all.slice(0, 6);
}

function msRenderDashboard() {
  const settings = msGetSettings();
  const subjects = msGetSubjects();
  const tasks = msGetTasks();
  const grades = msGetGrades();

  document.getElementById("greetingText").textContent = `${msGreetingWord()}, ${settings.studentName} ✨`;
  document.getElementById("dashDate").textContent = msTodayLongStr();

  // Stat cards
  const gpa = msComputeSemesterGPA(subjects, grades);
  document.getElementById("statGPA").textContent = gpa === null ? "—" : gpa.toFixed(2) + " / 4.00";
  const totalCredits = subjects.reduce((s, x) => s + x.credits, 0);
  document.getElementById("statCredits").textContent = totalCredits;
  const completedTasks = tasks.filter(t => t.completed).length;
  document.getElementById("statCompleted").textContent = completedTasks;
  const progressPct = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  document.getElementById("statProgress").textContent = progressPct + "%";
  msDrawRing(document.getElementById("progressRing"), progressPct);

  // Upcoming deadlines
  const deadlineList = document.getElementById("deadlineList");
  const deadlines = msDashboardDeadlines();
  if (deadlines.length === 0) {
    deadlineList.innerHTML = msEmptyStateHtml("bi-calendar-check", "No deadlines yet ✨", "Add a task or event to see it show up here.", null);
  } else {
    deadlineList.innerHTML = deadlines.map(d => {
      const subject = msGetSubjectById(d.subjectId);
      let rightTag;
      if (d.days < 0) rightTag = `<span class="tag tag-overdue">${Math.abs(d.days)}d overdue</span>`;
      else if (d.days === 0) rightTag = `<span class="tag tag-today">Today</span>`;
      else rightTag = `<span class="tag tag-neutral">${d.days} day${d.days === 1 ? "" : "s"} left</span>`;
      return `
        <div class="list-row">
          <span class="row-dot dot-${d.priority.toLowerCase()}"></span>
          <div class="flex-grow-1">
            <div class="row-title">${msEscapeHtml(d.title)}</div>
            <div class="row-meta">${subject ? msEscapeHtml(subject.name) : ""} · ${msEscapeHtml(d.type)} · ${msFormatShort(d.date)}</div>
          </div>
          <span class="tag ${msPriorityTagClass(d.priority)}">${d.priority}</span>
          ${rightTag}
        </div>`;
    }).join("");
  }

  // Subjects overview
  const subjectList = document.getElementById("dashSubjectList");
  if (subjects.length === 0) {
    subjectList.innerHTML = msEmptyStateHtml("bi-journal-bookmark", "No subjects yet", "Add subjects to track their progress.", null);
  } else {
    subjectList.innerHTML = subjects.map(s => {
      const subjTasks = tasks.filter(t => t.subjectId === s.id);
      const done = subjTasks.filter(t => t.completed).length;
      const pct = subjTasks.length ? Math.round((done / subjTasks.length) * 100) : 0;
      return `
        <div class="d-flex align-items-center gap-2 py-2">
          <span class="row-dot" style="background:var(--${s.color === "rose" ? "rose-deep" : s.color === "gold" ? "gold" : "sage-deep"})"></span>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between"><span class="fw-semibold small">${msEscapeHtml(s.name)}</span><span class="small text-faint">${pct}%</span></div>
            <div class="progress-track mt-1"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        </div>`;
    }).join("");
  }

  // Weekly overview
  document.getElementById("weekStrip").innerHTML = msWeekStripHtml();

  // Daily focus
  msRenderDailyFocus();
}

function msDrawRing(container, pct) {
  if (!container) return;
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  container.innerHTML = `
    <svg viewBox="0 0 76 76">
      <circle class="ring-bg" cx="38" cy="38" r="${r}"></circle>
      <circle class="ring-fg" cx="38" cy="38" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
    </svg>
    <div class="ring-label">${pct}%</div>`;
}

function msWeekStripHtml() {
  const today = msToday();
  const start = msStartOfWeek(today);
  const tasks = msGetTasks();
  const events = msGetEvents();
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  let html = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = msDateStr(d);
    const isToday = ds === msDateStr(today);
    const dayTasks = tasks.filter(t => t.dueDate === ds);
    const dayEvents = events.filter(e => e.date === ds);
    const count = dayTasks.length + dayEvents.length;
    const doneCount = dayTasks.filter(t => t.completed).length;
    let label;
    if (count === 0) label = "Free";
    else if (isToday) label = `${count} due`;
    else if (dayTasks.length && doneCount === dayTasks.length && dayEvents.length === 0) label = "Done";
    else label = `${count} item${count === 1 ? "" : "s"}`;
    html += `
      <div class="week-day ${isToday ? "is-today" : ""}">
        <div class="wd-name">${dayNames[i]}</div>
        <div class="wd-date">${d.getDate()}</div>
        <div class="wd-count">${label}</div>
      </div>`;
  }
  return html;
}

function msRenderDailyFocus() {
  const el = document.getElementById("dailyFocusList");
  if (!el) return;
  const todayStr = msDateStr(msToday());
  const focus = getData(MS_KEYS.dailyFocus, {});
  let ids = focus[todayStr] || [];
  const tasks = msGetTasks();

  // if no focus chosen yet, default to top 3 pending tasks due soonest
  if (ids.length === 0) {
    ids = tasks.filter(t => !t.completed)
      .sort((a, b) => msParseDate(a.dueDate) - msParseDate(b.dueDate))
      .slice(0, 3).map(t => t.id);
  }

  const focusTasks = ids.map(id => tasks.find(t => t.id === id)).filter(Boolean);

  if (focusTasks.length === 0) {
    el.innerHTML = msEmptyStateHtml("bi-stars", "Nothing planned yet", "Add tasks to build today's focus list.", null);
  } else {
    el.innerHTML = focusTasks.map(t => {
      const subject = msGetSubjectById(t.subjectId);
      const mins = t.estMinutes ? (t.estMinutes >= 60 ? (t.estMinutes / 60).toFixed(t.estMinutes % 60 === 0 ? 0 : 1) + " hr" : t.estMinutes + " min") : "";
      return `
        <div class="d-flex align-items-center gap-2 py-2">
          <button class="task-check ${t.completed ? "done" : ""}" onclick="msToggleTaskFromDashboard('${t.id}')" aria-label="Toggle complete">
            <i class="bi bi-check2"></i>
          </button>
          <div class="flex-grow-1">
            <div class="small fw-semibold ${t.completed ? "text-decoration-line-through text-faint" : ""}">${msEscapeHtml(t.title)}${subject ? " — " + msEscapeHtml(subject.name) : ""}</div>
          </div>
          <span class="small text-faint">${mins}</span>
        </div>`;
    }).join("");
  }

  // note
  const noteArea = document.getElementById("dailyNoteArea");
  if (noteArea) {
    const notes = getData(MS_KEYS.dailyNotes, {});
    noteArea.value = notes[todayStr] || "";
  }
}

function msToggleTaskFromDashboard(taskId) {
  updateData(MS_KEYS.tasks, list => list.map(t => t.id === taskId ? { ...t, completed: !t.completed, completedDate: !t.completed ? msDateStr(msToday()) : null } : t), []);
  msRenderDashboard();
}

function msSaveDailyNote() {
  const todayStr = msDateStr(msToday());
  const val = document.getElementById("dailyNoteArea").value;
  updateData(MS_KEYS.dailyNotes, notes => ({ ...notes, [todayStr]: val }), {});
  msToast("Note saved", "bi-check-circle");
}

function msEmptyStateHtml(icon, title, body, buttonHtml) {
  return `
    <div class="empty-state">
      <div class="empty-icon"><i class="bi ${icon}"></i></div>
      <h3>${title}</h3>
      <p>${body}</p>
      ${buttonHtml || ""}
    </div>`;
}
