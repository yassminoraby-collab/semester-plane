/* ==========================================================================
   calendar.js — monthly calendar view + event CRUD
   ========================================================================== */

let msCalYear, msCalMonth; // 0-indexed month
let msCalSelectedDate = null;

function msCalInit() {
  const today = msToday();
  msCalYear = today.getFullYear();
  msCalMonth = today.getMonth();
  msRenderCalendar();
  msPopulateEventSubjectOptions();
}

function msCalPrev() {
  msCalMonth--;
  if (msCalMonth < 0) { msCalMonth = 11; msCalYear--; }
  msRenderCalendar();
}
function msCalNext() {
  msCalMonth++;
  if (msCalMonth > 11) { msCalMonth = 0; msCalYear++; }
  msRenderCalendar();
}
function msCalGoToday() {
  const today = msToday();
  msCalYear = today.getFullYear();
  msCalMonth = today.getMonth();
  msRenderCalendar();
}

const MS_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MS_DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function msRenderCalendar() {
  document.getElementById("calMonthLabel").textContent = `${MS_MONTH_NAMES[msCalMonth]} ${msCalYear}`;

  const events = msGetEvents();
  const today = msToday();
  const todayStr = msDateStr(today);

  const firstOfMonth = new Date(msCalYear, msCalMonth, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 sun
  const daysInMonth = new Date(msCalYear, msCalMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(msCalYear, msCalMonth, 0).getDate();

  let cells = [];
  // leading (previous month) muted days
  for (let i = 0; i < startWeekday; i++) {
    const dayNum = daysInPrevMonth - startWeekday + i + 1;
    const d = new Date(msCalYear, msCalMonth - 1, dayNum);
    cells.push({ date: d, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(msCalYear, msCalMonth, d), muted: false });
  }
  // trailing days to complete the grid (multiple of 7)
  let trail = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(msCalYear, msCalMonth + 1, trail), muted: true });
    trail++;
  }

  let dowHtml = MS_DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");

  let cellsHtml = cells.map(cell => {
    const ds = msDateStr(cell.date);
    const isToday = ds === todayStr;
    const dayEvents = events.filter(e => e.date === ds).sort((a,b) => (a.time||"").localeCompare(b.time||""));
    const shown = dayEvents.slice(0, 3);
    const more = dayEvents.length - shown.length;
    return `
      <div class="cal-cell ${cell.muted ? "muted" : ""} ${isToday ? "today" : ""}" onclick="msOpenDayModal('${ds}')">
        <div class="cal-daynum">${cell.date.getDate()}</div>
        ${shown.map(e => `<div class="cal-event type-${e.type.toLowerCase()}">${msEscapeHtml(e.title)}</div>`).join("")}
        ${more > 0 ? `<div class="cal-more">+${more} more</div>` : ""}
      </div>`;
  }).join("");

  document.getElementById("calGrid").innerHTML = dowHtml + cellsHtml;
}

function msPopulateEventSubjectOptions() {
  const subjects = msGetSubjects();
  const select = document.getElementById("eventSubject");
  if (!select) return;
  select.innerHTML = `<option value="">No specific subject</option>` +
    subjects.map(s => `<option value="${s.id}">${msEscapeHtml(s.name)}</option>`).join("");
}

function msOpenDayModal(dateStr) {
  msCalSelectedDate = dateStr;
  document.getElementById("dayModalDate").textContent = msFormatLong(dateStr);
  const events = msGetEvents().filter(e => e.date === dateStr).sort((a,b) => (a.time||"").localeCompare(b.time||""));
  const list = document.getElementById("dayModalList");

  if (events.length === 0) {
    list.innerHTML = msEmptyStateHtml("bi-calendar3", "No events this day", "Add one to keep your day on track.", null);
  } else {
    list.innerHTML = events.map(e => {
      const subject = msGetSubjectById(e.subjectId);
      return `
        <div class="list-row">
          <span class="tag tag-neutral cal-event type-${e.type.toLowerCase()}" style="min-width:80px;text-align:center;">${e.type}</span>
          <div class="flex-grow-1">
            <div class="row-title">${msEscapeHtml(e.title)}</div>
            <div class="row-meta">${subject ? msEscapeHtml(subject.name) + " · " : ""}${e.time ? e.time : "All day"}</div>
          </div>
          <span class="tag ${msPriorityTagClass(e.priority)}">${e.priority}</span>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="msEditEvent('${e.id}')" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-danger-soft btn-icon btn-sm" onclick="msDeleteEvent('${e.id}')" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </div>`;
    }).join("");
  }

  new bootstrap.Modal(document.getElementById("dayModal")).show();
}

function msOpenAddEventFromDay() {
  bootstrap.Modal.getInstance(document.getElementById("dayModal"))?.hide();
  msOpenEventModal(null, msCalSelectedDate);
}

function msOpenEventModal(eventId, presetDate) {
  const form = document.getElementById("eventForm");
  form.reset();
  document.getElementById("eventFormError").classList.remove("show-error");
  document.getElementById("eventId").value = "";

  if (eventId) {
    const ev = msGetEvents().find(e => e.id === eventId);
    if (ev) {
      document.getElementById("eventId").value = ev.id;
      document.getElementById("eventTitle").value = ev.title;
      document.getElementById("eventType").value = ev.type;
      document.getElementById("eventSubject").value = ev.subjectId || "";
      document.getElementById("eventDate").value = ev.date;
      document.getElementById("eventTime").value = ev.time || "";
      document.getElementById("eventPriority").value = ev.priority;
      document.getElementById("eventNotes").value = ev.notes || "";
    }
    document.getElementById("eventModalTitle").textContent = "Edit Event";
  } else {
    document.getElementById("eventModalTitle").textContent = "Add Event";
    if (presetDate) document.getElementById("eventDate").value = presetDate;
  }
  new bootstrap.Modal(document.getElementById("eventModal")).show();
}

function msEditEvent(id) {
  bootstrap.Modal.getInstance(document.getElementById("dayModal"))?.hide();
  msOpenEventModal(id, null);
}

function msDeleteEvent(id) {
  updateData(MS_KEYS.events, list => list.filter(e => e.id !== id), []);
  msToast("Event deleted", "bi-trash");
  msRenderCalendar();
  if (document.getElementById("dayModal").classList.contains("show")) {
    msOpenDayModal(msCalSelectedDate);
  }
}

function msSubmitEventForm(evt) {
  evt.preventDefault();
  const title = document.getElementById("eventTitle").value.trim();
  const type = document.getElementById("eventType").value;
  const subjectId = document.getElementById("eventSubject").value;
  const date = document.getElementById("eventDate").value;
  const time = document.getElementById("eventTime").value;
  const priority = document.getElementById("eventPriority").value;
  const notes = document.getElementById("eventNotes").value.trim();
  const id = document.getElementById("eventId").value;

  let valid = true;
  msSetFieldValidity("eventTitle", title.length > 0);
  msSetFieldValidity("eventType", !!type);
  msSetFieldValidity("eventDate", !!date);
  msSetFieldValidity("eventPriority", !!priority);
  if (!title || !type || !date || !priority) valid = false;

  if (!valid) return;

  if (id) {
    updateData(MS_KEYS.events, list => list.map(e => e.id === id ? { ...e, title, type, subjectId, date, time, priority, notes } : e), []);
    msToast("Event updated", "bi-check-circle");
  } else {
    const newEvent = { id: msUid("evt"), title, type, subjectId, date, time, priority, notes };
    updateData(MS_KEYS.events, list => [...list, newEvent], []);
    msToast("Event added", "bi-check-circle");
  }

  bootstrap.Modal.getInstance(document.getElementById("eventModal"))?.hide();
  msRenderCalendar();
}

function msSetFieldValidity(fieldId, isValid) {
  const field = document.getElementById(fieldId);
  const wrap = field.closest(".was-validated-field");
  if (wrap) wrap.classList.toggle("is-invalid", !isValid);
}
