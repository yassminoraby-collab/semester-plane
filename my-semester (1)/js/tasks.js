/* ==========================================================================
   tasks.js — task management page
   ========================================================================== */

let msTaskFilter = "all";
let msTaskSort = "dueDate";
let msTaskSearch = "";

function msTasksInit() {
  msPopulateTaskSubjectOptions();
  msRenderTasks();
}

function msPopulateTaskSubjectOptions() {
  const subjects = msGetSubjects();
  const select = document.getElementById("taskSubject");
  if (select) {
    select.innerHTML = `<option value="">Choose…</option>` + subjects.map(s => `<option value="${s.id}">${msEscapeHtml(s.name)}</option>`).join("");
  }
}

function msSetTaskFilter(filter) {
  msTaskFilter = filter;
  document.querySelectorAll("#taskFilterPills .pill-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
  msRenderTasks();
}

function msSetTaskSort(sort) {
  msTaskSort = sort;
  msRenderTasks();
}

function msSetTaskSearch(value) {
  msTaskSearch = value.toLowerCase();
  msRenderTasks();
}

function msFilteredSortedTasks() {
  const today = msToday();
  const weekFromNow = new Date(today); weekFromNow.setDate(weekFromNow.getDate() + 7);
  let tasks = msGetTasks();

  tasks = tasks.filter(t => {
    if (msTaskSearch && !t.title.toLowerCase().includes(msTaskSearch)) return false;
    const due = msParseDate(t.dueDate);
    switch (msTaskFilter) {
      case "today": return msDateStr(due) === msDateStr(today) && !t.completed;
      case "week": return due >= today && due <= weekFromNow && !t.completed;
      case "completed": return t.completed;
      case "pending": return !t.completed;
      case "overdue": return due < today && !t.completed;
      default: return true;
    }
  });

  const subjName = id => { const s = msGetSubjectById(id); return s ? s.name : ""; };
  const priorityRank = { High: 0, Medium: 1, Low: 2 };

  tasks.sort((a, b) => {
    switch (msTaskSort) {
      case "priority": return priorityRank[a.priority] - priorityRank[b.priority];
      case "subject": return subjName(a.subjectId).localeCompare(subjName(b.subjectId));
      case "completion": return Number(a.completed) - Number(b.completed);
      default: return msParseDate(a.dueDate) - msParseDate(b.dueDate);
    }
  });

  return tasks;
}

function msRenderTasks() {
  const list = document.getElementById("taskList");
  const tasks = msFilteredSortedTasks();
  const today = msToday();

  if (tasks.length === 0) {
    list.innerHTML = msEmptyStateHtml("bi-check2-square", "No tasks found ✨",
      "Add your first task to start planning your semester.",
      `<button class="btn btn-brand btn-sm" onclick="msOpenTaskModal(null)"><i class="bi bi-plus-lg me-1"></i>Add Task</button>`);
    return;
  }

  list.innerHTML = tasks.map(t => {
    const subject = msGetSubjectById(t.subjectId);
    const due = msParseDate(t.dueDate);
    const isOverdue = !t.completed && due < today;
    const days = msDaysBetween(today, due);
    let dueLabel;
    if (t.completed) dueLabel = `Completed ${t.completedDate ? msFormatShort(t.completedDate) : ""}`;
    else if (days < 0) dueLabel = `${Math.abs(days)}d overdue`;
    else if (days === 0) dueLabel = "Due today";
    else dueLabel = `Due ${msFormatShort(t.dueDate)}`;

    const mins = t.estMinutes ? (t.estMinutes >= 60 ? (t.estMinutes / 60) + " hr" : t.estMinutes + " min") : "";

    return `
      <div class="task-row ${t.completed ? "completed" : ""} ${isOverdue ? "overdue" : ""}">
        <button class="task-check ${t.completed ? "done" : ""}" onclick="msToggleTask('${t.id}')" aria-label="Toggle complete">
          <i class="bi bi-check2"></i>
        </button>
        <div class="flex-grow-1">
          <div class="task-title">${msEscapeHtml(t.title)}</div>
          <div class="task-meta">${subject ? msEscapeHtml(subject.name) + " · " : ""}${msEscapeHtml(t.type)}${mins ? " · " + mins : ""} · ${dueLabel}</div>
        </div>
        <span class="tag ${msPriorityTagClass(t.priority)}">${t.priority}</span>
        <div class="task-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="msOpenTaskModal('${t.id}')" aria-label="Edit task"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-danger-soft btn-icon btn-sm" onclick="msDeleteTask('${t.id}')" aria-label="Delete task"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
  }).join("");
}

function msToggleTask(id) {
  updateData(MS_KEYS.tasks, list => list.map(t => t.id === id ? { ...t, completed: !t.completed, completedDate: !t.completed ? msDateStr(msToday()) : null } : t), []);
  msRenderTasks();
}

function msDeleteTask(id) {
  updateData(MS_KEYS.tasks, list => list.filter(t => t.id !== id), []);
  msToast("Task deleted", "bi-trash");
  msRenderTasks();
}

function msOpenTaskModal(taskId) {
  const form = document.getElementById("taskForm");
  form.reset();
  document.getElementById("taskId").value = "";
  document.querySelectorAll("#taskModal .was-validated-field").forEach(f => f.classList.remove("is-invalid"));

  if (taskId) {
    const t = msGetTasks().find(x => x.id === taskId);
    if (t) {
      document.getElementById("taskId").value = t.id;
      document.getElementById("taskTitle").value = t.title;
      document.getElementById("taskSubject").value = t.subjectId || "";
      document.getElementById("taskDueDate").value = t.dueDate;
      document.getElementById("taskType").value = t.type;
      document.getElementById("taskPriority").value = t.priority;
      document.getElementById("taskEstMinutes").value = t.estMinutes || "";
      document.getElementById("taskNotes").value = t.notes || "";
    }
    document.getElementById("taskModalTitle").textContent = "Edit Task";
  } else {
    document.getElementById("taskModalTitle").textContent = "Add Task";
  }
  new bootstrap.Modal(document.getElementById("taskModal")).show();
}

function msSubmitTaskForm(evt) {
  evt.preventDefault();
  const id = document.getElementById("taskId").value;
  const title = document.getElementById("taskTitle").value.trim();
  const subjectId = document.getElementById("taskSubject").value;
  const dueDate = document.getElementById("taskDueDate").value;
  const type = document.getElementById("taskType").value;
  const priority = document.getElementById("taskPriority").value;
  const estMinutesRaw = document.getElementById("taskEstMinutes").value;
  const notes = document.getElementById("taskNotes").value.trim();

  let valid = true;
  const check = (id2, ok) => { document.getElementById(id2).closest(".was-validated-field").classList.toggle("is-invalid", !ok); if (!ok) valid = false; };
  check("taskTitle", title.length > 0);
  check("taskDueDate", !!dueDate);
  check("taskType", !!type);
  check("taskPriority", !!priority);
  const estMinutes = estMinutesRaw === "" ? null : Number(estMinutesRaw);
  check("taskEstMinutes", estMinutes === null || estMinutes >= 0);

  if (!valid) return;

  if (id) {
    updateData(MS_KEYS.tasks, list => list.map(t => t.id === id ? { ...t, title, subjectId, dueDate, type, priority, estMinutes, notes } : t), []);
    msToast("Task updated", "bi-check-circle");
  } else {
    const newTask = { id: msUid("task"), title, subjectId, dueDate, type, priority, estMinutes, notes, completed: false, completedDate: null };
    updateData(MS_KEYS.tasks, list => [...list, newTask], []);
    msToast("Task added", "bi-check-circle");
  }

  bootstrap.Modal.getInstance(document.getElementById("taskModal"))?.hide();
  msRenderTasks();
}
