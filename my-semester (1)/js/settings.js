/* ==========================================================================
   settings.js — student/semester preferences, theme, reset
   ========================================================================== */

function msSettingsInit() {
  const settings = msGetSettings();
  document.getElementById("settingName").value = settings.studentName;
  document.getElementById("settingSemester").value = settings.semesterName;
  document.getElementById("settingTargetGPA").value = settings.targetGPA;
  document.getElementById("settingTheme").value = settings.theme;
}

function msSaveSettings(evt) {
  evt.preventDefault();
  const studentName = document.getElementById("settingName").value.trim();
  const semesterName = document.getElementById("settingSemester").value.trim();
  const targetGPARaw = document.getElementById("settingTargetGPA").value;
  const theme = document.getElementById("settingTheme").value;

  let valid = true;
  const check = (id, ok) => { document.getElementById(id).closest(".was-validated-field").classList.toggle("is-invalid", !ok); if (!ok) valid = false; };
  check("settingName", studentName.length > 0);
  check("settingSemester", semesterName.length > 0);
  const targetGPA = Number(targetGPARaw);
  check("settingTargetGPA", targetGPARaw !== "" && targetGPA >= 0 && targetGPA <= 4);

  if (!valid) return;

  updateData(MS_KEYS.settings, s => ({ ...s, studentName, semesterName, targetGPA, theme }), msDefaultSettings());
  msApplyTheme(theme);
  msInitChrome("settings");
  msToast("Settings saved", "bi-check-circle");
}

function msConfirmReset() {
  new bootstrap.Modal(document.getElementById("resetModal")).show();
}

function msPerformReset() {
  msResetAllData();
  msToast("Planner data reset", "bi-arrow-clockwise");
  setTimeout(() => window.location.reload(), 500);
}
