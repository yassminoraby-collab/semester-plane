/* ==========================================================================
   progress.js — semester progress & analytics
   ========================================================================== */

function msProgressInit() {
  msRenderProgressPage();
}

function msRenderProgressPage() {
  const subjects = msGetSubjects();
  const tasks = msGetTasks();
  const events = msGetEvents();
  const goals = msGetGoals();
  const grades = msGetGrades();
  const today = msToday();

  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.filter(t => !t.completed && msParseDate(t.dueDate) >= today).length;
  const overdue = tasks.filter(t => !t.completed && msParseDate(t.dueDate) < today).length;
  const overallPct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  msDrawRing(document.getElementById("overallRing"), overallPct);
  document.getElementById("overallSub").textContent = `${completed} / ${tasks.length} tasks completed`;

  document.getElementById("statCompletedTasks").textContent = completed;
  document.getElementById("statPendingTasks").textContent = pending;
  document.getElementById("statOverdueTasks").textContent = overdue;

  const completedGoals = goals.filter(g => g.completed).length;
  document.getElementById("statGoals").textContent = `${completedGoals} / ${goals.length}`;

  const totalStudyMinutes = tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.estMinutes || 0), 0);
  document.getElementById("statStudyHours").textContent = (totalStudyMinutes / 60).toFixed(1) + " hr";

  const upcomingCount = [...tasks.filter(t => !t.completed), ...events]
    .filter(x => msParseDate(x.dueDate || x.date) >= today).length;
  document.getElementById("statUpcoming").textContent = upcomingCount;

  const gpa = msComputeSemesterGPA(subjects, grades);
  document.getElementById("statGpaProgress").textContent = gpa === null ? "—" : gpa.toFixed(2);

  // Subject progress bars
  const subjWrap = document.getElementById("subjectProgressList");
  if (subjects.length === 0) {
    subjWrap.innerHTML = msEmptyStateHtml("bi-journal-bookmark", "No subjects yet", "Subject progress will show up here.", null);
  } else {
    subjWrap.innerHTML = subjects.map(s => {
      const subjTasks = tasks.filter(t => t.subjectId === s.id);
      const done = subjTasks.filter(t => t.completed).length;
      const pct = subjTasks.length ? Math.round((done / subjTasks.length) * 100) : 0;
      const accent = msSubjectAccentClass(s);
      return `
        <div class="mb-3">
          <div class="d-flex justify-content-between small mb-1">
            <span class="fw-semibold">${msEscapeHtml(s.name)}</span>
            <span class="text-faint">${done}/${subjTasks.length} · ${pct}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%; background:${accent.text};"></div></div>
        </div>`;
    }).join("");
  }
}
