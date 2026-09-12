/* ==========================================================================
   storage.js — localStorage data layer for My Semester
   Every other script reads/writes data only through the functions here.
   ========================================================================== */

const MS_KEYS = {
  tasks: "ms_tasks",
  events: "ms_events",
  subjects: "ms_subjects",
  grades: "ms_grades",
  goals: "ms_goals",
  habits: "ms_habits",
  dailyNotes: "ms_dailyNotes",
  dailyFocus: "ms_dailyFocus",
  subjectNotes: "ms_subjectNotes",
  settings: "ms_settings",
  seeded: "ms_seeded_v1",
  gradesSchemaV2: "ms_grades_schema_v2",
  weeklyPriorities: "ms_weeklyPriorities",
  weeklyNotes: "ms_weeklyNotes"
};

/* ---------- generic helpers ---------- */

function msUid(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("getData failed for", key, e);
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("saveData failed for", key, e);
    return false;
  }
}

function deleteData(key) {
  localStorage.removeItem(key);
}

function updateData(key, updaterFn, fallback) {
  const current = getData(key, fallback);
  const next = updaterFn(current);
  saveData(key, next);
  return next;
}

/* ---------- date helpers ---------- */

function msToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function msDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function msParseDate(str) {
  // parse yyyy-mm-dd as a local date (avoid UTC shift)
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function msDaysBetween(fromDate, toDate) {
  const ms = msParseDate(msDateStr(toDate)) - msParseDate(msDateStr(fromDate));
  return Math.round(ms / 86400000);
}

function msFormatShort(dateStr) {
  const d = msParseDate(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function msFormatLong(dateStr) {
  const d = msParseDate(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function msStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- grading scale ---------- */

const MS_GRADE_SCALE = [
  { min: 97, letter: "A+", gpa: 4.0 },
  { min: 93, letter: "A", gpa: 4.0 },
  { min: 90, letter: "A-", gpa: 3.7 },
  { min: 87, letter: "B+", gpa: 3.3 },
  { min: 83, letter: "B", gpa: 3.0 },
  { min: 80, letter: "B-", gpa: 2.7 },
  { min: 77, letter: "C+", gpa: 2.3 },
  { min: 73, letter: "C", gpa: 2.0 },
  { min: 70, letter: "C-", gpa: 1.7 },
  { min: 67, letter: "D+", gpa: 1.3 },
  { min: 60, letter: "D", gpa: 1.0 },
  { min: -Infinity, letter: "F", gpa: 0.0 }
];

function msLetterFromPercent(pct) {
  for (const row of MS_GRADE_SCALE) {
    if (pct >= row.min) return row;
  }
  return MS_GRADE_SCALE[MS_GRADE_SCALE.length - 1];
}

/* ---------- assessment weights (configurable per subject) ---------- */

// keys of a subject's assessment breakdown; every subject stores its own
// weight/maxScore/score per key — NOT a global fixed distribution.
function msAssessmentKeys() { return ["quizzes", "assignments", "midterm", "final"]; }

// sample/demo defaults only — used when a subject has no saved config yet.
// Never overwrites an existing per-subject configuration.
const MS_DEFAULT_ASSESSMENT_WEIGHTS = { quizzes: 10, assignments: 10, midterm: 20, final: 60 };

function msDefaultAssessments() {
  const out = {};
  msAssessmentKeys().forEach(k => {
    out[k] = { weight: MS_DEFAULT_ASSESSMENT_WEIGHTS[k], maxScore: MS_DEFAULT_ASSESSMENT_WEIGHTS[k], score: null };
  });
  return out;
}

// returns { quizzes:{weight,maxScore,score}, assignments:{...}, midterm:{...}, final:{...} }
function msGetSubjectAssessments(subjectId) {
  const grades = msGetGrades();
  const row = grades[subjectId];
  if (row && row.assessments) return row.assessments;
  return msDefaultAssessments();
}

function msSaveSubjectAssessments(subjectId, assessments) {
  updateData(MS_KEYS.grades, grades => ({ ...grades, [subjectId]: { ...(grades[subjectId] || {}), assessments } }), {});
}

function msWeightsTotal(assessments) {
  return msAssessmentKeys().reduce((sum, k) => sum + (assessments[k] ? Number(assessments[k].weight) || 0 : 0), 0);
}

function msWeightsValid(assessments) {
  return Math.abs(msWeightsTotal(assessments) - 100) < 0.001;
}

function msGradeStatus(assessments) {
  if (!assessments) return "none";
  const keys = msAssessmentKeys();
  const entered = keys.filter(k => assessments[k] && assessments[k].score !== null && assessments[k].score !== undefined && assessments[k].score !== "");
  if (entered.length === 0) return "none";
  if (entered.length === keys.length) return "final";
  return "partial";
}

// Computes a subject's course percentage/letter/GPA from its OWN configured
// assessment weights. Never assumes a fixed distribution (e.g. Final = 40%)
// and never treats an ungraded assessment as zero — ungraded items are simply
// excluded until entered.
function msComputeGrade(assessments) {
  const row = assessments || msDefaultAssessments();
  const status = msGradeStatus(row);
  const weightTotal = msWeightsTotal(row);
  if (status === "none") return { status, percent: null, letter: null, gpa: null, weightGraded: 0, weightTotal };

  const keys = msAssessmentKeys();
  let earnedPoints = 0, weightGraded = 0;
  keys.forEach(k => {
    const a = row[k];
    if (a && a.score !== null && a.score !== undefined && a.score !== "") {
      const max = Number(a.maxScore) || 0;
      const weight = Number(a.weight) || 0;
      const scorePct = max > 0 ? Number(a.score) / max : 0;
      earnedPoints += scorePct * weight;
      weightGraded += weight;
    }
  });

  if (status === "partial") {
    return { status, percent: earnedPoints, letter: null, gpa: null, weightGraded, weightTotal };
  }
  // status === "final": every assessment graded — scale against the
  // subject's own total weight (defensive if it isn't exactly 100).
  const percent = weightTotal > 0 ? (earnedPoints / weightTotal) * 100 : earnedPoints;
  const scaleRow = msLetterFromPercent(percent);
  return { status, percent, letter: scaleRow.letter, gpa: scaleRow.gpa, weightGraded, weightTotal };
}

function msComputeSemesterGPA(subjects, grades) {
  let weightedSum = 0, creditSum = 0;
  subjects.forEach(s => {
    const assessments = (grades[s.id] && grades[s.id].assessments) || msDefaultAssessments();
    const computed = msComputeGrade(assessments);
    if (computed.status === "final") {
      weightedSum += computed.gpa * s.credits;
      creditSum += s.credits;
    }
  });
  if (creditSum === 0) return null;
  return weightedSum / creditSum;
}

/* ---------- migration: old fixed-distribution grades -> per-subject weights ---------- */
// Old shape: grades[subjectId] = { quiz, assignment, midterm, final } (numbers 0..max,
// implicit fixed weights quiz10/assignment20/midterm30/final40). Converting with
// weight = old max and maxScore = old max keeps the computed percentage identical,
// so existing saved data is preserved exactly, not wiped.
function msMigrateGradesToWeighted() {
  if (getData(MS_KEYS.gradesSchemaV2, false)) return;
  const OLD_MAX = { quiz: 10, assignment: 20, midterm: 30, final: 40 };
  const grades = getData(MS_KEYS.grades, {});
  const migrated = {};
  Object.keys(grades).forEach(subjectId => {
    const row = grades[subjectId];
    if (row && row.assessments) {
      migrated[subjectId] = row; // already migrated
      return;
    }
    if (row && (row.quiz !== undefined || row.assignment !== undefined || row.midterm !== undefined || row.final !== undefined)) {
      migrated[subjectId] = {
        assessments: {
          quizzes:     { weight: OLD_MAX.quiz,       maxScore: OLD_MAX.quiz,       score: row.quiz ?? null },
          assignments: { weight: OLD_MAX.assignment, maxScore: OLD_MAX.assignment, score: row.assignment ?? null },
          midterm:     { weight: OLD_MAX.midterm,     maxScore: OLD_MAX.midterm,   score: row.midterm ?? null },
          final:       { weight: OLD_MAX.final,       maxScore: OLD_MAX.final,     score: row.final ?? null }
        }
      };
    } else {
      migrated[subjectId] = row;
    }
  });
  saveData(MS_KEYS.grades, migrated);
  saveData(MS_KEYS.gradesSchemaV2, true);
}

/* ---------- default settings ---------- */

function msDefaultSettings() {
  return {
    studentName: "Yasmin",
    semesterName: "Fall 2026",
    targetGPA: 3.6,
    theme: "light"
  };
}

/* ---------- sample data seeding ---------- */

function msSeedIfNeeded() {
  if (getData(MS_KEYS.seeded, false)) return;

  const subjects = [
    { id: "sub_report", name: "Report Writing", credits: 2, color: "sage" },
    { id: "sub_oop", name: "OOP", credits: 3, color: "rose" },
    { id: "sub_ds", name: "Data Structure", credits: 3, color: "sage" },
    { id: "sub_math", name: "Discrete Mathematics", credits: 3, color: "gold" },
    { id: "sub_logic", name: "Logic Design", credits: 3, color: "rose" },
    { id: "sub_db", name: "Database", credits: 3, color: "sage" },
    { id: "sub_eng", name: "English", credits: 2, color: "gold" }
  ];

  const today = msToday();
  const iso = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return msDateStr(d);
  };

  const tasks = [
    { id: msUid("task"), title: "Study inheritance (OOP)", subjectId: "sub_oop", dueDate: iso(0), type: "Study", priority: "High", estMinutes: 60, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Solve discrete problems", subjectId: "sub_math", dueDate: iso(0), type: "Study", priority: "High", estMinutes: 90, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Database assignment", subjectId: "sub_db", dueDate: iso(1), type: "Assignment", priority: "High", estMinutes: 120, notes: "Cover normalization up to 3NF", completed: false, completedDate: null },
    { id: msUid("task"), title: "Review logic design", subjectId: "sub_logic", dueDate: iso(2), type: "Revision", priority: "Medium", estMinutes: 60, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Report writing draft", subjectId: "sub_report", dueDate: iso(3), type: "Assignment", priority: "Medium", estMinutes: 90, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Read English chapter 2", subjectId: "sub_eng", dueDate: iso(3), type: "Study", priority: "Low", estMinutes: 45, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Finish OOP lecture notes", subjectId: "sub_oop", dueDate: iso(-2), type: "Study", priority: "Medium", estMinutes: 40, notes: "", completed: true, completedDate: iso(-2) },
    { id: msUid("task"), title: "Data structure quiz prep", subjectId: "sub_ds", dueDate: iso(5), type: "Quiz", priority: "High", estMinutes: 75, notes: "", completed: false, completedDate: null },
    { id: msUid("task"), title: "Discrete math homework set 3", subjectId: "sub_math", dueDate: iso(-5), type: "Assignment", priority: "Medium", estMinutes: 60, notes: "", completed: true, completedDate: iso(-6) },
    { id: msUid("task"), title: "Database ERD practice", subjectId: "sub_db", dueDate: iso(-1), type: "Study", priority: "Low", estMinutes: 45, notes: "", completed: false, completedDate: null }
  ];

  const events = [
    { id: msUid("evt"), title: "OOP Lecture", type: "Lecture", subjectId: "sub_oop", date: iso(0), time: "10:00", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "OOP Quiz 1", type: "Quiz", subjectId: "sub_oop", date: iso(6), time: "11:00", priority: "High", notes: "Covers ch.1-3" },
    { id: msUid("evt"), title: "Database Lecture", type: "Lecture", subjectId: "sub_db", date: iso(-2), time: "09:00", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "Database Assignment", type: "Assignment", subjectId: "sub_db", date: iso(1), time: "23:59", priority: "High", notes: "" },
    { id: msUid("evt"), title: "Discrete Lecture", type: "Lecture", subjectId: "sub_math", date: iso(-4), time: "13:00", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "Logic Lecture", type: "Lecture", subjectId: "sub_logic", date: iso(-1), time: "12:00", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "Logic Quiz 1", type: "Quiz", subjectId: "sub_logic", date: iso(11), time: "10:00", priority: "Medium", notes: "" },
    { id: msUid("evt"), title: "Report Writing Assignment", type: "Assignment", subjectId: "sub_report", date: iso(15), time: "23:59", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "Discrete Midterm", type: "Midterm", subjectId: "sub_math", date: iso(20), time: "09:00", priority: "Medium", notes: "" },
    { id: msUid("evt"), title: "State Lecture", type: "Lecture", subjectId: "sub_report", date: iso(8), time: "10:00", priority: "Low", notes: "" },
    { id: msUid("evt"), title: "Database Quiz", type: "Quiz", subjectId: "sub_db", date: iso(4), time: "10:00", priority: "Medium", notes: "" }
  ];

  const gradeRow = (quizScore, assignmentScore) => ({
    assessments: {
      quizzes:     { weight: 10, maxScore: 10, score: quizScore },
      assignments: { weight: 10, maxScore: 10, score: assignmentScore },
      midterm:     { weight: 20, maxScore: 20, score: null },
      final:       { weight: 60, maxScore: 60, score: null }
    }
  });
  const grades = {
    sub_oop: gradeRow(9, 9),
    sub_db: gradeRow(8, 8),
    sub_ds: gradeRow(7, 8),
    sub_logic: gradeRow(8, 9),
    sub_report: gradeRow(9, 8),
    sub_math: gradeRow(null, null),
    sub_eng: gradeRow(null, null)
  };

  const goals = [
    { id: msUid("goal"), text: "Keep GPA above 3.6", completed: false },
    { id: msUid("goal"), text: "Never miss a deadline", completed: false },
    { id: msUid("goal"), text: "Finish assignments 2 days early", completed: false },
    { id: msUid("goal"), text: "Study Data Structure 4 times a week", completed: false }
  ];

  const weekStart = msDateStr(msStartOfWeek(today));
  const habits = {
    weekStart,
    list: [
      { id: msUid("habit"), name: "Study", days: [true, true, false, true, false, false, false] },
      { id: msUid("habit"), name: "Reading", days: [true, false, true, true, false, true, false] },
      { id: msUid("habit"), name: "Exercise", days: [false, true, false, true, false, true, false] }
    ]
  };

  saveData(MS_KEYS.subjects, subjects);
  saveData(MS_KEYS.tasks, tasks);
  saveData(MS_KEYS.events, events);
  saveData(MS_KEYS.grades, grades);
  saveData(MS_KEYS.goals, goals);
  saveData(MS_KEYS.habits, habits);
  saveData(MS_KEYS.dailyNotes, {});
  saveData(MS_KEYS.dailyFocus, {});
  saveData(MS_KEYS.subjectNotes, {});
  saveData(MS_KEYS.settings, msDefaultSettings());
  saveData(MS_KEYS.weeklyPriorities, {});
  saveData(MS_KEYS.weeklyNotes, {});
  saveData(MS_KEYS.gradesSchemaV2, true);
  saveData(MS_KEYS.seeded, true);
}

function msResetAllData() {
  Object.values(MS_KEYS).forEach(k => deleteData(k));
  msSeedIfNeeded();
}

/* ---------- shared getters (with lazy defaults) ---------- */

function msGetSubjects() { return getData(MS_KEYS.subjects, []); }
function msGetTasks() { return getData(MS_KEYS.tasks, []); }
function msGetEvents() { return getData(MS_KEYS.events, []); }
function msGetGrades() { return getData(MS_KEYS.grades, {}); }
function msGetGoals() { return getData(MS_KEYS.goals, []); }
function msGetHabits() {
  const h = getData(MS_KEYS.habits, null);
  if (h) return h;
  return { weekStart: msDateStr(msStartOfWeek(msToday())), list: [] };
}
function msGetSettings() { return getData(MS_KEYS.settings, msDefaultSettings()); }
function msGetSubjectById(id) { return msGetSubjects().find(s => s.id === id); }
function msGetWeeklyPriorities() { return getData(MS_KEYS.weeklyPriorities, {}); }
function msGetWeeklyNotes() { return getData(MS_KEYS.weeklyNotes, {}); }

function msSubjectAccentClass(subject) {
  const c = subject && subject.color ? subject.color : "sage";
  if (c === "rose") return { tint: "tint-rose", text: "var(--rose-deep)" };
  if (c === "gold") return { tint: "tint-beige", text: "var(--gold)" };
  return { tint: "tint-sage", text: "var(--sage-deep)" };
}
