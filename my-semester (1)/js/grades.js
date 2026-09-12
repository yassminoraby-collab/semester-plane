/* ==========================================================================
   grades.js — grade tracker + GPA calculation
   Each subject defines its OWN assessment weights (quizzes/assignments/
   midterm/final) — no fixed distribution is assumed anywhere in this file.
   ========================================================================== */

const MS_ASSESSMENT_LABELS = { quizzes: "Quizzes", assignments: "Assignments", midterm: "Midterm", final: "Final" };

let msGradeWeightsEditingSubjectId = null;
let msGradeWeightsDraft = null; // working copy while the weights modal is open

function msGradesInit() {
  msRenderGradesTable();
}

function msRenderGradesTable() {
  const subjects = msGetSubjects();
  const grades = msGetGrades();
  const tbody = document.getElementById("gradesTableBody");

  if (subjects.length === 0) {
    document.getElementById("gradesEmptyState").classList.remove("d-none");
    document.getElementById("gradesTableWrap").classList.add("d-none");
    return;
  }

  tbody.innerHTML = subjects.map(s => {
    const assessments = (grades[s.id] && grades[s.id].assessments) || msDefaultAssessments();
    const computed = msComputeGrade(assessments);

    let gradeCell;
    if (computed.status === "final") gradeCell = `<span class="grade-pill">${computed.letter}</span>`;
    else if (computed.status === "partial") gradeCell = `<span class="grade-pill partial">${computed.percent.toFixed(0)}% so far</span>`;
    else gradeCell = `<span class="grade-pill na">Not graded</span>`;

    const field = (key) => {
      const a = assessments[key];
      const graded = a.score !== null && a.score !== undefined && a.score !== "";
      return `
        <input type="number" min="0" max="${a.maxScore}" step="0.5" class="form-control grade-input ${graded ? "" : "grade-input-empty"}"
          value="${graded ? a.score : ""}" placeholder="—"
          onchange="msUpdateScore('${s.id}', '${key}', this)" data-max="${a.maxScore}">
        <div class="text-faint" style="font-size:.68rem;">/ ${a.maxScore} · ${a.weight}%${graded ? "" : " · not graded"}</div>`;
    };

    return `
      <tr>
        <td class="fw-semibold">${msEscapeHtml(s.name)}<div class="text-faint" style="font-size:.72rem;">${s.credits} credits</div></td>
        <td>${field("quizzes")}</td>
        <td>${field("assignments")}</td>
        <td>${field("midterm")}</td>
        <td>${field("final")}</td>
        <td>${computed.status === "none" ? "—" : computed.percent.toFixed(1) + "%"}</td>
        <td>${gradeCell}</td>
        <td><button class="btn btn-ghost btn-icon btn-sm" onclick="msOpenWeightsModal('${s.id}')" aria-label="Edit assessment weights"><i class="bi bi-sliders"></i></button></td>
      </tr>`;
  }).join("");

  document.getElementById("gradesEmptyState").classList.add("d-none");
  document.getElementById("gradesTableWrap").classList.remove("d-none");

  msRenderGpaSummary();
}

function msUpdateScore(subjectId, key, inputEl) {
  const max = Number(inputEl.dataset.max);
  let val = inputEl.value === "" ? null : Number(inputEl.value);
  if (val !== null && (isNaN(val) || val < 0 || val > max)) {
    inputEl.classList.add("is-invalid");
    msToast(`Enter a value between 0 and ${max}.`, "bi-exclamation-circle");
    return;
  }
  inputEl.classList.remove("is-invalid");

  const assessments = msGetSubjectAssessments(subjectId);
  assessments[key] = { ...assessments[key], score: val };
  msSaveSubjectAssessments(subjectId, assessments);
  msRenderGradesTable();
}

function msRenderGpaSummary() {
  const subjects = msGetSubjects();
  const grades = msGetGrades();
  const gpa = msComputeSemesterGPA(subjects, grades);
  document.getElementById("gpaValue").textContent = gpa === null ? "—" : gpa.toFixed(2) + " / 4.0";

  const gradedCount = subjects.filter(s => {
    const assessments = (grades[s.id] && grades[s.id].assessments) || msDefaultAssessments();
    return msGradeStatus(assessments) === "final";
  }).length;
  document.getElementById("gpaSubtext").textContent = gradedCount === 0
    ? "No final grades yet"
    : `${gradedCount} of ${subjects.length} subjects finalized`;

  const settings = msGetSettings();
  document.getElementById("gpaTarget").textContent = `Target ${Number(settings.targetGPA).toFixed(1)}`;

  const track = document.getElementById("gpaTrack");
  const pct = gpa === null ? 0 : Math.min(100, (gpa / 4) * 100);
  track.style.width = pct + "%";
}

/* ---------- assessment weights modal ---------- */

function msOpenWeightsModal(subjectId) {
  const subject = msGetSubjectById(subjectId);
  if (!subject) return;
  msGradeWeightsEditingSubjectId = subjectId;
  // deep-copy so edits don't touch storage until Save
  const current = msGetSubjectAssessments(subjectId);
  msGradeWeightsDraft = {};
  msAssessmentKeys().forEach(k => { msGradeWeightsDraft[k] = { ...current[k] }; });

  document.getElementById("weightsModalSubjectName").textContent = subject.name;
  msRenderWeightsForm();
  new bootstrap.Modal(document.getElementById("weightsModal")).show();
}

function msRenderWeightsForm() {
  const wrap = document.getElementById("weightsFormBody");
  wrap.innerHTML = msAssessmentKeys().map(k => {
    const a = msGradeWeightsDraft[k];
    return `
      <div class="row g-2 align-items-end mb-2">
        <div class="col-5">
          <label class="form-label mb-1">${MS_ASSESSMENT_LABELS[k]} weight (%)</label>
          <input type="number" min="0" max="100" step="0.5" class="form-control" value="${a.weight}"
            oninput="msUpdateWeightDraft('${k}', 'weight', this.value)">
        </div>
        <div class="col-4">
          <label class="form-label mb-1">Max score</label>
          <input type="number" min="0" step="0.5" class="form-control" value="${a.maxScore}"
            oninput="msUpdateWeightDraft('${k}', 'maxScore', this.value)">
        </div>
        <div class="col-3">
          <label class="form-label mb-1">Score</label>
          <input type="number" min="0" step="0.5" class="form-control" value="${a.score === null || a.score === undefined ? "" : a.score}"
            placeholder="—" oninput="msUpdateWeightDraft('${k}', 'score', this.value)">
        </div>
      </div>`;
  }).join("");
  msRenderWeightsTotal();
}

function msUpdateWeightDraft(key, field, rawValue) {
  const val = rawValue === "" ? (field === "score" ? null : 0) : Number(rawValue);
  msGradeWeightsDraft[key] = { ...msGradeWeightsDraft[key], [field]: val };
  if (field === "weight") msRenderWeightsTotal();
}

function msRenderWeightsTotal() {
  const total = msWeightsTotal(msGradeWeightsDraft);
  const totalEl = document.getElementById("weightsTotalMsg");
  const valid = Math.abs(total - 100) < 0.001;
  totalEl.textContent = valid
    ? `Total weight: ${total}% ✓`
    : `Total weight: ${total}% — must equal exactly 100% to save.`;
  totalEl.classList.toggle("weights-total-valid", valid);
  totalEl.classList.toggle("weights-total-invalid", !valid);
  document.getElementById("saveWeightsBtn").disabled = !valid;
}

function msSaveWeightsForm() {
  if (!msWeightsValid(msGradeWeightsDraft)) {
    msToast("Weights must total exactly 100% before saving.", "bi-exclamation-circle");
    return;
  }
  msSaveSubjectAssessments(msGradeWeightsEditingSubjectId, msGradeWeightsDraft);
  bootstrap.Modal.getInstance(document.getElementById("weightsModal"))?.hide();
  msToast("Assessment weights saved", "bi-check-circle");
  msRenderGradesTable();
}
