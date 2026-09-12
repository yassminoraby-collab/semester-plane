/* ==========================================================================
   goals.js — goals list + weekly habit tracker
   ========================================================================== */

const MS_HABIT_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function msGoalsInit() {
  msRenderGoals();
  msRenderHabits();
}

/* ---------- Goals ---------- */

function msRenderGoals() {
  const goals = msGetGoals();
  const list = document.getElementById("goalsList");
  if (goals.length === 0) {
    list.innerHTML = msEmptyStateHtml("bi-flag", "No goals yet", "Set a goal to stay focused this semester.",
      `<button class="btn btn-brand btn-sm" onclick="msOpenGoalModal(null)"><i class="bi bi-plus-lg me-1"></i>Add Goal</button>`);
    return;
  }
  list.innerHTML = goals.map(g => `
    <div class="goal-row ${g.completed ? "done" : ""}">
      <button class="goal-check ${g.completed ? "done" : ""}" onclick="msToggleGoal('${g.id}')" aria-label="Toggle goal complete">
        <i class="bi bi-check2"></i>
      </button>
      <div class="flex-grow-1 goal-text">${msEscapeHtml(g.text)}</div>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="msOpenGoalModal('${g.id}')" aria-label="Edit goal"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-danger-soft btn-icon btn-sm" onclick="msDeleteGoal('${g.id}')" aria-label="Delete goal"><i class="bi bi-trash"></i></button>
    </div>`).join("");
}

function msToggleGoal(id) {
  updateData(MS_KEYS.goals, list => list.map(g => g.id === id ? { ...g, completed: !g.completed } : g), []);
  msRenderGoals();
}

function msDeleteGoal(id) {
  updateData(MS_KEYS.goals, list => list.filter(g => g.id !== id), []);
  msToast("Goal deleted", "bi-trash");
  msRenderGoals();
}

function msOpenGoalModal(goalId) {
  document.getElementById("goalId").value = "";
  document.getElementById("goalText").value = "";
  document.getElementById("goalText").closest(".was-validated-field").classList.remove("is-invalid");
  if (goalId) {
    const g = msGetGoals().find(x => x.id === goalId);
    if (g) {
      document.getElementById("goalId").value = g.id;
      document.getElementById("goalText").value = g.text;
    }
    document.getElementById("goalModalTitle").textContent = "Edit Goal";
  } else {
    document.getElementById("goalModalTitle").textContent = "Add Goal";
  }
  new bootstrap.Modal(document.getElementById("goalModal")).show();
}

function msSubmitGoalForm(evt) {
  evt.preventDefault();
  const id = document.getElementById("goalId").value;
  const text = document.getElementById("goalText").value.trim();
  const field = document.getElementById("goalText").closest(".was-validated-field");
  if (!text) { field.classList.add("is-invalid"); return; }
  field.classList.remove("is-invalid");

  if (id) {
    updateData(MS_KEYS.goals, list => list.map(g => g.id === id ? { ...g, text } : g), []);
    msToast("Goal updated", "bi-check-circle");
  } else {
    updateData(MS_KEYS.goals, list => [...list, { id: msUid("goal"), text, completed: false }], []);
    msToast("Goal added", "bi-check-circle");
  }
  bootstrap.Modal.getInstance(document.getElementById("goalModal"))?.hide();
  msRenderGoals();
}

/* ---------- Habits ---------- */

function msCurrentHabitData() {
  const today = msToday();
  const weekStart = msDateStr(msStartOfWeek(today));
  let habits = msGetHabits();
  if (habits.weekStart !== weekStart) {
    // new week: reset completion but keep habit names
    habits = { weekStart, list: habits.list.map(h => ({ ...h, days: [false, false, false, false, false, false, false] })) };
    saveData(MS_KEYS.habits, habits);
  }
  return habits;
}

function msRenderHabits() {
  const habits = msCurrentHabitData();
  const wrap = document.getElementById("habitTrackerWrap");

  if (habits.list.length === 0) {
    wrap.innerHTML = msEmptyStateHtml("bi-repeat", "No habits yet", "Add a habit to start building a streak.",
      `<button class="btn btn-brand btn-sm" onclick="msOpenHabitModal()"><i class="bi bi-plus-lg me-1"></i>Add Habit</button>`);
    document.getElementById("habitCompletionPct").textContent = "0%";
    return;
  }

  let headerRow = `<div></div>` + MS_HABIT_DAY_LABELS.map(l => `<div class="habit-day-label">${l}</div>`).join("") + `<div></div>`;
  let rows = habits.list.map(h => {
    const cells = h.days.map((done, i) => `
      <button class="habit-dot ${done ? "done" : ""}" onclick="msToggleHabitDay('${h.id}', ${i})" aria-label="Toggle ${h.name} day ${i + 1}">
        <i class="bi bi-check2"></i>
      </button>`).join("");
    return `<div class="habit-name d-flex align-items-center">${msEscapeHtml(h.name)}</div>${cells}
      <button class="btn btn-ghost btn-icon btn-sm" onclick="msDeleteHabit('${h.id}')" aria-label="Delete habit"><i class="bi bi-trash"></i></button>`;
  }).join("");

  wrap.innerHTML = `<div class="habit-grid" style="grid-template-columns:120px repeat(7,1fr) 40px;">${headerRow}${rows}</div>`;

  const totalCells = habits.list.length * 7;
  const doneCells = habits.list.reduce((sum, h) => sum + h.days.filter(Boolean).length, 0);
  const pct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
  document.getElementById("habitCompletionPct").textContent = pct + "%";
}

function msToggleHabitDay(habitId, dayIndex) {
  updateData(MS_KEYS.habits, habits => {
    const list = habits.list.map(h => {
      if (h.id !== habitId) return h;
      const days = [...h.days];
      days[dayIndex] = !days[dayIndex];
      return { ...h, days };
    });
    return { ...habits, list };
  }, msCurrentHabitData());
  msRenderHabits();
}

function msDeleteHabit(habitId) {
  updateData(MS_KEYS.habits, habits => ({ ...habits, list: habits.list.filter(h => h.id !== habitId) }), msCurrentHabitData());
  msRenderHabits();
}

function msOpenHabitModal() {
  document.getElementById("habitNameInput").value = "";
  document.getElementById("habitNameInput").closest(".was-validated-field").classList.remove("is-invalid");
  new bootstrap.Modal(document.getElementById("habitModal")).show();
}

function msSubmitHabitForm(evt) {
  evt.preventDefault();
  const name = document.getElementById("habitNameInput").value.trim();
  const field = document.getElementById("habitNameInput").closest(".was-validated-field");
  if (!name) { field.classList.add("is-invalid"); return; }
  field.classList.remove("is-invalid");

  updateData(MS_KEYS.habits, habits => ({
    ...habits,
    list: [...habits.list, { id: msUid("habit"), name, days: [false, false, false, false, false, false, false] }]
  }), msCurrentHabitData());

  bootstrap.Modal.getInstance(document.getElementById("habitModal"))?.hide();
  msToast("Habit added", "bi-check-circle");
  msRenderHabits();
}
