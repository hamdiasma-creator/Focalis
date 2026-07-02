export function computeCycleStart() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var monBased = (today.getDay() + 6) % 7;
  var monday = new Date(today.getTime());
  monday.setDate(today.getDate() - monBased);
  return monday;
}

export function getDateForCell(cycleStart, weekIndex, dayIndex) {
  var d = new Date(cycleStart.getTime());
  d.setDate(d.getDate() + weekIndex * 7 + dayIndex);
  return d;
}

export function formatDate(date) {
  var months = ["janvier","fevrier","mars","avril","mai","juin",
                "juillet","aout","septembre","octobre","novembre","decembre"];
  return date.getDate() + " " + months[date.getMonth()];
}

export function getCurrentWeekAndDay(cycleStart) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var start = new Date(cycleStart.getTime()); start.setHours(0, 0, 0, 0);
  var diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diff < 0 || diff >= 28) return { week: 0, day: 0 };
  return { week: Math.floor(diff / 7), day: diff % 7 };
}

export function cellKey(w, d) { return "w" + w + "-" + d; }
export function taskKey(w, d, id) { return "w" + w + "-" + d + "-" + id; }

export function timeToMinutes(t) {
  if (!t) return null;
  var parts = t.split(":");
  var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
}

export function minutesToTime(mins) {
  var m = ((mins % 1440) + 1440) % 1440;
  var h = Math.floor(m / 60), mm = m % 60;
  return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
}

export function formatTimeDisplay(t) {
  if (!t) return "";
  var mins = timeToMinutes(t);
  if (mins === null) return t;
  var h = Math.floor(mins / 60), m = mins % 60;
  return (h < 10 ? "0" : "") + h + "h" + (m < 10 ? "0" : "") + m;
}

