
import { WEEKS, DAYS, getProfileTasks, getAllProfileTaskIds } from './data';
import { cellKey, taskKey } from './dateHelpers';

export function getTasksForCell(profileId, w, day, state) {
  var customs      = state.customs      || {};
  var moved        = state.moved        || {};
  var taskOverrides= state.taskOverrides|| {};
  var taskTimes    = state.taskTimes    || {};
  var important    = state.important    || {};

  // ── Base tasks from profile ──────────────────────────────────────────────
  var base = getProfileTasks(profileId, day).map(function(t) {
    var effectiveLabel = taskOverrides["override-" + t.id] || t.label;
    var effectiveTime  = taskTimes["base-" + t.id] || t.time;
    return Object.assign({}, t, { label: effectiveLabel, time: effectiveTime });
  });

  var ck       = cellKey(w, day);
  var movedArr = moved[ck] || [];

  // Strings that are NOT skip- markers are hidden base task ids
  var removedIds      = movedArr.filter(function(x) { return typeof x === "string" && x.indexOf("skip-") !== 0; });
  // skip-<id> means: hide this custom task occurrence only today
  var skippedCustomIds= movedArr.filter(function(x) { return typeof x === "string" && x.indexOf("skip-") === 0; }).map(function(x) { return x.slice(5); });
  // Objects are tasks moved IN from another day
  var movedIn         = movedArr.filter(function(x) { return typeof x === "object" && x !== null; });

  var filtered = base.filter(function(t) { return removedIds.indexOf(t.id) === -1; });

  // ── Custom tasks ──────────────────────────────────────────────────────────
  var customArr = [];
  Object.keys(customs).forEach(function(key) {
    (customs[key] || []).forEach(function(task) {
      if (skippedCustomIds.indexOf(task.id) !== -1) return;
      var perCellLbl   = taskOverrides[ck + "-lbl-" + task.id];
      var effectiveLabel = perCellLbl || task.label;
      var effectiveTime  = taskTimes["custom-" + task.id] || task.time;
      var enriched = Object.assign({}, task, {
        label: effectiveLabel, time: effectiveTime,
        _custom: true, _sourceKey: key,
      });
      if (task.freq === "once" && key === ck) {
        customArr.push(enriched);
      } else if (task.freq === "weekly") {
        var sourceDay = key.split("-").slice(1).join("-");
        if (sourceDay === day) customArr.push(enriched);
      } else if (task.freq === "custom" && (task.freqDays || []).indexOf(day) !== -1) {
        customArr.push(enriched);
      }
    });
  });

  var all = filtered
    .concat(movedIn.map(function(t) { return Object.assign({}, t, { _movedIn: true }); }))
    .concat(customArr)
    .map(function(t) { return Object.assign({}, t, { important: !!important[t.id] }); });

  // Sort by time if present
  all.sort(function(a, b) {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  return all;
}

export function getProgress(profileId, w, day, state) {
  var tasks = getTasksForCell(profileId, w, day, state);
  var done  = tasks.filter(function(t) { return !!state.checked[taskKey(w, day, t.id)]; }).length;
  return { done: done, total: tasks.length };
}

export function getWeekProgress(profileId, w, state) {
  return DAYS.reduce(function(acc, day) {
    var p = getProgress(profileId, w, day, state);
    return { done: acc.done + p.done, total: acc.total + p.total };
  }, { done: 0, total: 0 });
}

export function buildClearedMoved(profileId, moved) {
  var allIds = getAllProfileTaskIds(profileId);
  var next   = Object.assign({}, moved);
  for (var w = 0; w < WEEKS; w++) {
    DAYS.forEach(function(day) {
      var k   = cellKey(w, day);
      var cur = next[k] || [];
      var toHide = Object.keys(allIds).filter(function(id) { return cur.indexOf(id) === -1; });
      next[k] = cur.concat(toHide);
    });
  }
  return next;
}
