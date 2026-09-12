/* ==========================================================================
   subjects.js — subject list + subject detail (overview/tasks/assessments/notes)
   ========================================================================== */

function msSubjectsInit() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (id && msGetSubjectById(id)) {
    msRenderSubjectDetail(id);
  } else {
    msRenderSubjectList();
  }
}

function msSubjectAssessmentTypes() { return ["Assignment", "Quiz", "Midterm", "Final", "Project"]; }

function msRenderSubjectList() {
  document.getElementById("subjectListView").classList.remove("d-none");
  document.getElementById("subjectDetailView").classList.add("d-none");

  const subjects = msGetSubjects();
  const tasks = msGetTasks();
  const events = msGetEvents();
  const grades = msGetGrades();
  const today = msToday();
  const grid = document.getElementById("subjectGrid");

  if (subjects.length === 0) {
    grid.innerHTML = `<div class="col-12">` + msEmptyStateHtml("bi-journal-bookmark", "No subjects yet", "Your semester subjects will appear here.", null) + `</div>`;
    return;
  }

  grid.innerHTML = subjects.map(s => {
    const accent = msSubjectAccentClass(s);
    const subjTasks = tasks.filter(t => t.subjectId === s.id);
    const done = subjTasks.filter(t => t.completed).length;
    const pct = subjTasks.length ? Math.round((done / subjTasks.length) * 100) : 0;

    const upcoming = [
      ...subjTasks.filter(t => !t.completed).map(t => ({ date: t.dueDate, title: t.title })),
      ...events.filter(e => e.subjectId === s.id).map(e => ({ date: e.date, title: e.title }))
    ].filter(x => msParseDate(x.date) >= today).sort((a, b) => msParseDate(a.date) - msParseDate(b.date))[0];

    const g = msComputeGrade((grades[s.id] && grades[s.id].assessments) || msDefaultAssessments());
    let gradeHtml;
    if (g.status === "final") gradeHtml = `<span class="grade-pill">${g.letter}</span>`;
    else if (g.status === "partial") gradeHtml = `<span class="grade-pill partial">${g.percent.toFixed(0)}%</span>`;
    else gradeHtml = `<span class="grade-pill na">No grade yet</span>`;

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card-soft card-pad subject-card hover-lift">
          <div class="d-flex align-items-start justify-content-between">
            <div class="subject-icon ${accent.tint}">${msEscapeHtml(s.name.charAt(0))}</div>
            ${gradeHtml}
          </div>
          <div>
            <div class="section-title">${msEscapeHtml(s.name)}</div>
            <div class="text-faint small">${s.credits} credit${s.credits === 1 ? "" : "s"}</div>
          </div>
          <div>
            <div class="d-flex justify-content-between small mb-1"><span class="text-muted-ink">Progress</span><span>${pct}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="d-flex justify-content-between small text-faint">
            <span>${done}/${subjTasks.length} tasks done</span>
            <span>${upcoming ? "Next: " + msFormatShort(upcoming.date) : "No deadlines"}</span>
          </div>
          <a class="btn btn-outline-soft w-100 mt-1" href="subjects.html?id=${s.id}">Open Subject</a>
        </div>
      </div>`;
  }).join("");
}

function msRenderSubjectDetail(id) {
  document.getElementById("subjectListView").classList.add("d-none");
  document.getElementById("subjectDetailView").classList.remove("d-none");

  const s = msGetSubjectById(id);
  const tasks = msGetTasks().filter(t => t.subjectId === id);
  const events = msGetEvents().filter(e => e.subjectId === id);
  const grades = msGetGrades();
  const g = msComputeGrade((grades[id] && grades[id].assessments) || msDefaultAssessments());
  const done = tasks.filter(t => t.completed).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  document.getElementById("subjectDetailName").textContent = s.name;
  document.getElementById("subjectDetailCredits").textContent = `${s.credits} credit${s.credits === 1 ? "" : "s"}`;
  document.getElementById("subjectDetailGradeTag").textContent = g.status === "final" ? `Grade ${g.letter}` : g.status === "partial" ? `${g.percent.toFixed(0)}% so far` : "Not graded yet";

  msDrawRing(document.getElementById("subjectDetailRing"), pct);
  document.getElementById("subjectDetailTaskCount").textContent = `${done} / ${tasks.length} tasks completed`;

  const today = msToday();
  const nextDeadline = [
    ...tasks.filter(t => !t.completed).map(t => ({ date: t.dueDate, title: t.title })),
    ...events.map(e => ({ date: e.date, title: e.title }))
  ].filter(x => msParseDate(x.date) >= today).sort((a, b) => msParseDate(a.date) - msParseDate(b.date))[0];
  document.getElementById("subjectDetailNextDeadline").textContent = nextDeadline ? `${nextDeadline.title} — ${msFormatShort(nextDeadline.date)}` : "No upcoming deadlines";

  // Tasks tab
  const taskListEl = document.getElementById("subjectTaskList");
  if (tasks.length === 0) {
    taskListEl.innerHTML = msEmptyStateHtml("bi-check2-square", "No tasks yet", "Tasks for this subject will appear here.", `<a class="btn btn-brand btn-sm" href="tasks.html">Go to Tasks</a>`);
  } else {
    taskListEl.innerHTML = tasks.sort((a, b) => msParseDate(a.dueDate) - msParseDate(b.dueDate)).map(t => `
      <div class="list-row">
        <span class="task-check ${t.completed ? "done" : ""}" style="cursor:default;"><i class="bi bi-check2"></i></span>
        <div class="flex-grow-1">
          <div class="row-title ${t.completed ? "text-decoration-line-through text-faint" : ""}">${msEscapeHtml(t.title)}</div>
          <div class="row-meta">${msEscapeHtml(t.type)} · ${msFormatShort(t.dueDate)}</div>
        </div>
        <span class="tag ${msPriorityTagClass(t.priority)}">${t.priority}</span>
      </div>`).join("");
  }

  // Assessments tab (events of assessment types + tasks of Assignment/Quiz/Project type)
  const assessmentEl = document.getElementById("subjectAssessmentList");
  const assessmentEvents = events.filter(e => msSubjectAssessmentTypes().includes(e.type));
  if (assessmentEvents.length === 0) {
    assessmentEl.innerHTML = msEmptyStateHtml("bi-clipboard-check", "No assessments scheduled", "Assignments, quizzes, midterms and finals show up here.", null);
  } else {
    assessmentEl.innerHTML = assessmentEvents.sort((a, b) => msParseDate(a.date) - msParseDate(b.date)).map(e => `
      <div class="list-row">
        <span class="tag tag-neutral" style="min-width:90px;text-align:center;">${e.type}</span>
        <div class="flex-grow-1">
          <div class="row-title">${msEscapeHtml(e.title)}</div>
          <div class="row-meta">${msFormatShort(e.date)}${e.time ? " · " + e.time : ""}</div>
        </div>
        <span class="tag ${msPriorityTagClass(e.priority)}">${e.priority}</span>
      </div>`).join("");
  }

  // Notes tab
  const notes = getData(MS_KEYS.subjectNotes, {});
  document.getElementById("subjectNotesArea").value = notes[id] || "";
  document.getElementById("subjectNotesArea").dataset.subjectId = id;
}

function msSaveSubjectNotes() {
  const area = document.getElementById("subjectNotesArea");
  const id = area.dataset.subjectId;
  updateData(MS_KEYS.subjectNotes, notes => ({ ...notes, [id]: area.value }), {});
  msToast("Notes saved", "bi-check-circle");
}
