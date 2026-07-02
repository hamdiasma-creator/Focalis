import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, SafeAreaView, StatusBar, Platform
} from 'react-native';

import { WEEKS, DAYS, DAY_SHORT, FREQ_OPTIONS, PROFILES, isWeekend } from './src/data';
import { THEME, makeStyles } from './src/theme';
import { computeCycleStart, getDateForCell, formatDate, getCurrentWeekAndDay, cellKey, taskKey, formatTimeDisplay } from './src/dateHelpers';
import { load, save } from './src/storage';
import { getTasksForCell, getProgress, getWeekProgress, buildClearedMoved } from './src/taskLogic';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (e) {}

const T = THEME;
const DEFAULT_REMINDER = {
  enabled: false,
  presetIds: [],
  intervalEnabled: false,
  intervalStart: "08:00",
  intervalEnd: "20:00",
  intervalHours: 2,
};

const REMINDER_PRESETS = [
  { id: "h9",  label: "9h00",  hour: 9,  minute: 0 },
  { id: "h12", label: "Midi",  hour: 12, minute: 0 },
  { id: "h16", label: "16h00", hour: 16, minute: 0 },
  { id: "h20", label: "20h00", hour: 20, minute: 0 },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const s = makeStyles(T);

  // Core state
  const [ready,      setReady]      = useState(false);
  const [cycleStart, setCycleStart] = useState(null);
  const [week,       setWeek]       = useState(0);
  const [dayIdx,     setDayIdx]     = useState(0);

  // User / profile
  const [userName,    setUserName]    = useState("");
  const [nameInput,   setNameInput]   = useState("");
  const [profileId,   setProfileId]   = useState(null);
  const [showWelcome, setShowWelcome] = useState(false); // name + profile first-run

  // Task data
  const [checked,       setChecked]       = useState({});
  const [meals,         setMeals]         = useState({});
  const [customs,       setCustoms]       = useState({});
  const [moved,         setMoved]         = useState({});
  const [taskOverrides, setTaskOverrides] = useState({});
  const [taskTimes,     setTaskTimes]     = useState({});
  const [important,     setImportant]     = useState({});

  // Modals
  const [showReset,         setShowReset]         = useState(false);
  const [resetStep,         setResetStep]         = useState(1); // 1=confirm 2=profile? 3=carry
  const [pendingProfileId,  setPendingProfileId]  = useState(null);
  const [carryCustoms,      setCarryCustoms]      = useState(false);
  const [showClearGeneric,  setShowClearGeneric]  = useState(false);
  const [showAdd,           setShowAdd]           = useState(false);
  const [newLabel,          setNewLabel]          = useState("");
  const [newMeal,           setNewMeal]           = useState(false);
  const [newFreq,           setNewFreq]           = useState("once");
  const [newDays,           setNewDays]           = useState([]);
  const [newTime,           setNewTime]           = useState("");
  const [newImportant,      setNewImportant]      = useState(false);
  const [moveMenu,          setMoveMenu]          = useState(null);
  const [delMenu,           setDelMenu]           = useState(null);
  const [showDelRepeat,     setShowDelRepeat]     = useState(false);
  const [editMenu,          setEditMenu]          = useState(null);
  const [editLabel,         setEditLabel]         = useState("");
  const [editTime,          setEditTime]          = useState("");
  const [editImportant,     setEditImportant]     = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [showEditScope,     setShowEditScope]     = useState(false);
  const [pendingEdit,       setPendingEdit]       = useState(null);
  const [showReminders,     setShowReminders]     = useState(false);
  const [reminderSettings,  setReminderSettings]  = useState(DEFAULT_REMINDER);

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(function () {
    try {
      var cs = computeCycleStart();
      setCycleStart(cs);
      Promise.all([
        load("ac", {}), load("am", {}), load("cu", {}), load("mv", {}),
        load("userName", ""), load("profileId", null),
        load("taskOverrides", {}), load("taskTimes", {}), load("important", {}),
        load("cycleStartStr", null), load("reminderSettings", DEFAULT_REMINDER),
      ]).then(function (r) {
        try {
          setChecked(r[0]); setMeals(r[1]); setCustoms(r[2]); setMoved(r[3]);
          var savedName = r[4]; var savedProfile = r[5];
          setTaskOverrides(r[6]); setTaskTimes(r[7]); setImportant(r[8]);
          setReminderSettings(r[10] || DEFAULT_REMINDER);

          var effectiveStart = cs;
          if (r[9]) { var stored = new Date(r[9]); if (!isNaN(stored.getTime())) effectiveStart = stored; }
          else save("cycleStartStr", cs.toISOString());
          setCycleStart(effectiveStart);

          var ini = getCurrentWeekAndDay(effectiveStart);
          setWeek(ini.week); setDayIdx(ini.day);

          if (!savedName || !savedProfile) {
            setShowWelcome(true);
          } else {
            setUserName(savedName); setProfileId(savedProfile);
          }
          setReady(true);
        } catch (e) { setReady(true); }
      }).catch(function () { setReady(true); });
    } catch (e) { setReady(true); }
  }, []);

  // ─── Notifications ─────────────────────────────────────────────────────────

  useEffect(function () {
    if (!ready || !Notifications) return;
    try {
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });
      (async function () {
        var perm = await Notifications.requestPermissionsAsync();
        if (perm.status !== 'granted') return;
        await scheduleReminders(reminderSettings, userName);
      })();
    } catch (e) {}
  }, [ready, reminderSettings, userName]);

  async function scheduleReminders(settings, name) {
    if (!Notifications) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!settings || !settings.enabled) return;
      var title = name ? "Rappel — " + name : "Focalis";
      var body  = "Tu as des taches non realisees aujourd'hui.";
      var triggers = [];
      (settings.presetIds || []).forEach(function (id) {
        var p = REMINDER_PRESETS.find(function (x) { return x.id === id; });
        if (p) triggers.push({ hour: p.hour, minute: p.minute });
      });
      if (settings.intervalEnabled) {
        var sm = timeStr2min(settings.intervalStart || "08:00");
        var em = timeStr2min(settings.intervalEnd   || "20:00");
        var st = (settings.intervalHours || 2) * 60;
        if (sm !== null && em !== null) for (var m = sm; m <= em; m += st) triggers.push({ hour: Math.floor(m/60), minute: m%60 });
      }
      var seen = {};
      triggers.forEach(async function (trig) {
        var k = trig.hour + ":" + trig.minute;
        if (seen[k]) return; seen[k] = true;
        try { await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: { hour: trig.hour, minute: trig.minute, repeats: true } }); } catch (e) {}
      });
    } catch (e) {}
  }

  function timeStr2min(t) {
    if (!t) return null;
    var p = t.split(":"); var h = parseInt(p[0],10); var m = parseInt(p[1],10);
    return (isNaN(h)||isNaN(m)) ? null : h*60+m;
  }

  // ─── Welcome (first run) ───────────────────────────────────────────────────

  const [welcomeStep,        setWelcomeStep]        = useState(1); // 1=name, 2=profile
  const [welcomeProfileSel,  setWelcomeProfileSel]  = useState(null);

  async function finishWelcome() {
    var n = nameInput.trim();
    if (!n || !welcomeProfileSel) return;
    setUserName(n); setProfileId(welcomeProfileSel);
    await save("userName", n); await save("profileId", welcomeProfileSel);
    setShowWelcome(false);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  var effectiveProfile = profileId || "VIERGE";
  var state = { checked, meals, customs, moved, taskOverrides, taskTimes, important };

  var currentDay = DAYS[dayIdx];
  var colors = isWeekend(currentDay)
    ? { bg: "#EEEDF8", accent: T.weekend, tag: "Weekend" }
    : { bg: "#EBF3FC", accent: T.accent,  tag: "Journee" };

  var tasks   = getTasksForCell(effectiveProfile, week, currentDay, state);
  var prog    = getProgress(effectiveProfile, week, currentDay, state);
  var pct     = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  var todayDate = getDateForCell(cycleStart || computeCycleStart(), week, dayIdx);

  // ─── Task actions ──────────────────────────────────────────────────────────

  async function toggle(key) {
    var next = Object.assign({}, checked); next[key] = !next[key];
    setChecked(next); await save("ac", next);
  }

  async function updateMeal(key, val) {
    var next = Object.assign({}, meals); next[key] = val;
    setMeals(next); await save("am", next);
  }

  async function toggleImportant(taskId) {
    var next = Object.assign({}, important); next[taskId] = !next[taskId];
    setImportant(next); await save("important", next);
  }

  async function addTask() {
    if (!newLabel.trim()) return;
    var ck = cellKey(week, DAYS[dayIdx]);
    var task = { id: "c" + Date.now(), label: newLabel.trim(), isMeal: newMeal, freq: newFreq, freqDays: newFreq === "custom" ? newDays : [], time: newTime.trim() || null };
    var next = Object.assign({}, customs); next[ck] = (next[ck] || []).concat([task]);
    setCustoms(next); await save("cu", next);
    if (newImportant) { var ni = Object.assign({}, important); ni[task.id] = true; setImportant(ni); await save("important", ni); }
    setNewLabel(""); setNewMeal(false); setNewFreq("once"); setNewDays([]); setNewTime(""); setNewImportant(false); setShowAdd(false);
  }

  async function deleteTask(taskId, isCustom, sourceKey, deleteAll) {
    var ck = cellKey(week, DAYS[dayIdx]);
    if (isCustom) {
      if (deleteAll) {
        var next = Object.assign({}, customs);
        Object.keys(next).forEach(function (k) { next[k] = (next[k]||[]).filter(function(t){return t.id!==taskId;}); });
        setCustoms(next); await save("cu", next);
      } else {
        var nextM = Object.assign({}, moved);
        var cur = nextM[ck] || []; var marker = "skip-" + taskId;
        if (cur.indexOf(marker) === -1) nextM[ck] = cur.concat([marker]);
        setMoved(nextM); await save("mv", nextM);
      }
    } else {
      var next2 = Object.assign({}, moved);
      if (deleteAll) {
        for (var w = 0; w < WEEKS; w++) DAYS.forEach(function(day){ var k=cellKey(w,day); var c=next2[k]||[]; if(c.indexOf(taskId)===-1) next2[k]=c.concat([taskId]); });
      } else {
        var c2 = next2[ck]||[]; next2[ck] = c2.filter(function(x){return x!==taskId;}).concat([taskId]);
      }
      setMoved(next2); await save("mv", next2);
    }
    setDelMenu(null); setShowDelRepeat(false);
  }

  function handleDeletePress(task) {
    var isCustom = !!task._custom;
    var isRepeat = isCustom && task.freq && task.freq !== "once";
    setDelMenu({ taskId: task.id, label: task.label, isCustom, sourceKey: task._sourceKey || cellKey(week, DAYS[dayIdx]), isRepeat });
    if (isRepeat) setShowDelRepeat(true);
  }

  function handleEditPress(task) {
    setEditMenu(task); setEditLabel(task.label); setEditTime(task.time || ""); setEditImportant(!!task.important);
    setShowEditModal(true);
  }

  async function applyEdit(scope) {
    var task = pendingEdit.task; var newLbl = pendingEdit.newLabel; var newT = pendingEdit.newTime;
    var ck = cellKey(week, DAYS[dayIdx]);
    if (scope === "once") {
      var nextO = Object.assign({}, taskOverrides); nextO[ck + "-lbl-" + task.id] = newLbl;
      setTaskOverrides(nextO); await save("taskOverrides", nextO);
    } else if (scope === "all") {
      if (task._custom) {
        var nextC = Object.assign({}, customs);
        Object.keys(nextC).forEach(function(k){ nextC[k]=(nextC[k]||[]).map(function(t){ return t.id===task.id ? Object.assign({},t,{label:newLbl}) : t; }); });
        setCustoms(nextC); await save("cu", nextC);
      } else {
        var nextO2 = Object.assign({}, taskOverrides); nextO2["override-" + task.id] = newLbl;
        setTaskOverrides(nextO2); await save("taskOverrides", nextO2);
      }
    }
    if (newT !== (task.time || "")) {
      var nextTimes = Object.assign({}, taskTimes);
      nextTimes[(task._custom ? "custom-" : "base-") + task.id] = newT || null;
      setTaskTimes(nextTimes); await save("taskTimes", nextTimes);
    }
    var nextImp = Object.assign({}, important); nextImp[task.id] = !!pendingEdit.important;
    setImportant(nextImp); await save("important", nextImp);
    setShowEditScope(false); setPendingEdit(null);
  }

  async function moveTask(task, targetDayIdx) {
    var srcDay = DAYS[dayIdx]; var tgtDay = DAYS[targetDayIdx];
    var srcCk = cellKey(week, srcDay); var tgtCk = cellKey(week, tgtDay);
    var next = Object.assign({}, moved);
    // Remove from source day
    next[srcCk] = (next[srcCk]||[]).filter(function(x){ return x !== task.id; }).concat([task.id]);
    // Add to target day
    next[tgtCk] = (next[tgtCk]||[]).filter(function(x){ return typeof x !== "object" || x===null || x.id!==task.id; }).concat([Object.assign({},task,{movedFrom:srcDay})]);
    setMoved(next); await save("mv", next); setMoveMenu(null);
  }

  async function clearGenericTasks() {
    var next = buildClearedMoved(effectiveProfile, moved);
    setMoved(next); await save("mv", next); setShowClearGeneric(false);
  }

  // ─── Reset / new cycle ─────────────────────────────────────────────────────

  async function handleReset() {
    var newChecked = {}, newMeals = {}, newMoved = {};
    var newCustoms = carryCustoms ? Object.assign({}, customs) : {};
    var newProfile = pendingProfileId || effectiveProfile;
    var newStart = computeCycleStart();
    setCycleStart(newStart); await save("cycleStartStr", newStart.toISOString());
    var ini = getCurrentWeekAndDay(newStart);
    setChecked(newChecked); setMeals(newMeals); setMoved(newMoved); setCustoms(newCustoms);
    setTaskOverrides({}); setWeek(ini.week); setDayIdx(ini.day);
    setProfileId(newProfile); await save("profileId", newProfile);
    await Promise.all([save("ac",newChecked),save("am",newMeals),save("mv",newMoved),save("cu",newCustoms),save("taskOverrides",{})]);
    setShowReset(false); setResetStep(1); setPendingProfileId(null); setCarryCustoms(false);
  }

  async function updateReminderSettings(next) {
    setReminderSettings(next); await save("reminderSettings", next);
  }

  // ─── Render guard ──────────────────────────────────────────────────────────

  if (!ready || !cycleStart) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:T.bg, justifyContent:"center", alignItems:"center" }}>
        <Text style={{ color:T.muted, fontSize:16 }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />

      {/* ── Welcome Modal ── */}
      <Modal visible={showWelcome} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            {welcomeStep === 1 ? (
              <>
                <Text style={s.modalEmoji}>👋</Text>
                <Text style={s.modalTitle}>Bienvenue sur Focalis !</Text>
                <Text style={s.modalDesc}>Comment tu t'appelles ?</Text>
                <TextInput style={s.input} placeholder="Ton prenom..." placeholderTextColor={T.muted}
                  value={nameInput} onChangeText={setNameInput} autoFocus />
                <TouchableOpacity
                  style={{ backgroundColor: nameInput.trim() ? T.accent : T.border, padding:14, borderRadius:12, alignItems:"center", opacity: nameInput.trim() ? 1 : 0.5 }}
                  onPress={function(){ if(nameInput.trim()) setWelcomeStep(2); }}
                  disabled={!nameInput.trim()}>
                  <Text style={{ color:"#fff", fontWeight:"700", fontSize:14 }}>Continuer →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalEmoji}>👤</Text>
                <Text style={s.modalTitle}>Vous etes ?</Text>
                <Text style={s.modalDesc}>Choisis le profil qui te ressemble. Tu pourras le changer plus tard.</Text>
                <ScrollView style={{ maxHeight: 380 }}>
                  {Object.keys(PROFILES).map(function(id) {
                    var p = PROFILES[id]; var active = welcomeProfileSel === id;
                    return (
                      <TouchableOpacity key={id} onPress={function(){ setWelcomeProfileSel(id); }}
                        style={[s.profileCard, active && s.profileCardActive]}>
                        <Text style={s.profileEmoji}>{p.emoji}</Text>
                        <View style={{ flex:1 }}>
                          <Text style={s.profileLabel}>{p.label}</Text>
                          <Text style={s.profileDesc}>{p.description}</Text>
                        </View>
                        {active ? <Text style={{ color:T.accent, fontSize:18 }}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={{ backgroundColor: welcomeProfileSel ? T.accent : T.border, padding:14, borderRadius:12, alignItems:"center", marginTop:14, opacity: welcomeProfileSel ? 1 : 0.5 }}
                  onPress={finishWelcome} disabled={!welcomeProfileSel}>
                  <Text style={{ color:"#fff", fontWeight:"700", fontSize:14 }}>Commencer ✓</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Reset Modal step 1 — confirm ── */}
      <Modal visible={showReset && resetStep===1} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🔄</Text>
          <Text style={s.modalTitle}>Nouveau cycle ?</Text>
          <Text style={s.modalDesc}>Le cycle commencera a partir d'aujourd'hui ({formatDate(new Date())}).{"\n"}Les coches et repas seront remis a zero.</Text>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowReset(false); setResetStep(1); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary,{backgroundColor:T.accent,flex:1}]} onPress={function(){ setResetStep(2); }}>
              <Text style={s.btnPrimaryTxt}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Reset Modal step 2 — changer de profil ? ── */}
      <Modal visible={showReset && resetStep===2} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>👤</Text>
          <Text style={s.modalTitle}>Changer de profil ?</Text>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ setPendingProfileId(null); setResetStep(3); }}>
            <Text style={s.moveBtnDay}>Garder mon profil actuel</Text>
            <Text style={{ color:T.muted }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ setPendingProfileId("__pick__"); setResetStep(25); }}>
            <Text style={s.moveBtnDay}>Changer de profil</Text>
            <Text style={{ color:T.muted }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnCancel,{marginTop:8}]} onPress={function(){ setShowReset(false); setResetStep(1); }}>
            <Text style={s.btnCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Reset Modal step 2.5 — pick new profile ── */}
      <Modal visible={showReset && resetStep===25} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>Choisir un nouveau profil</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {Object.keys(PROFILES).map(function(id) {
              var p = PROFILES[id]; var active = (pendingProfileId===id);
              return (
                <TouchableOpacity key={id} onPress={function(){ setPendingProfileId(id); }}
                  style={[s.profileCard, active && s.profileCardActive]}>
                  <Text style={s.profileEmoji}>{p.emoji}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={s.profileLabel}>{p.label}</Text>
                  </View>
                  {active ? <Text style={{ color:T.accent }}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={[s.row,{marginTop:12}]}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setResetStep(2); }}>
              <Text style={s.btnCancelTxt}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary,{backgroundColor:T.accent,flex:1,opacity:pendingProfileId&&pendingProfileId!=="__pick__"?1:0.4}]}
              onPress={function(){ if(pendingProfileId&&pendingProfileId!=="__pick__") setResetStep(3); }}>
              <Text style={s.btnPrimaryTxt}>Suivant</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Reset Modal step 3 — carry customs ── */}
      <Modal visible={showReset && resetStep===3} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>📋</Text>
          <Text style={s.modalTitle}>Importer mes taches personnalisees ?</Text>
          <Text style={s.modalDesc}>Les taches que tu as creees toi-meme seront ajoutees a ton nouveau cycle.{"\n\n"}Note : les modifications des taches generiques seront effacees.</Text>
          <TouchableOpacity style={s.carryRow} onPress={function(){ setCarryCustoms(!carryCustoms); }}>
            <View style={[s.circle,{borderColor:T.accent},carryCustoms&&{backgroundColor:T.check,borderColor:T.check}]}>
              {carryCustoms?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
            </View>
            <View style={{flex:1}}>
              <Text style={s.carryTitle}>Importer mes taches personnalisees</Text>
              <Text style={s.carrySub}>Les taches generiques du profil seront remises a zero</Text>
            </View>
          </TouchableOpacity>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setResetStep(2); }}>
              <Text style={s.btnCancelTxt}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary,{backgroundColor:T.accent,flex:1}]} onPress={handleReset}>
              <Text style={s.btnPrimaryTxt}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Clear Generic Modal ── */}
      <Modal visible={showClearGeneric} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🧹</Text>
          <Text style={s.modalTitle}>Vider les taches generiques ?</Text>
          <Text style={s.modalDesc}>Toutes les taches du profil actuel seront retirees.{"\n"}Tes taches ajoutees restent intactes.</Text>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowClearGeneric(false); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDanger} onPress={clearGenericTasks}>
              <Text style={s.btnDangerTxt}>Vider</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Reminder Modal ── */}
      <Modal visible={showReminders} transparent animationType="slide">
        <View style={s.overlayBottom}><View style={s.modalBottom}>
          <Text style={s.modalTitle}>🔔 Rappels</Text>
          <ScrollView style={{ maxHeight: 480 }}>
            <TouchableOpacity style={s.carryRow} onPress={function(){ updateReminderSettings(Object.assign({},reminderSettings,{enabled:!reminderSettings.enabled})); }}>
              <View style={[s.circle,{borderColor:T.accent},reminderSettings.enabled&&{backgroundColor:T.check,borderColor:T.check}]}>
                {reminderSettings.enabled?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
              </View>
              <View style={{flex:1}}>
                <Text style={s.carryTitle}>Activer les rappels</Text>
                <Text style={s.carrySub}>Notifications pour les taches non realisees</Text>
              </View>
            </TouchableOpacity>
            {reminderSettings.enabled ? (
              <>
                <Text style={s.sectionLbl}>Heures fixes</Text>
                <View style={[s.row,{marginBottom:14}]}>
                  {REMINDER_PRESETS.map(function(p) {
                    var active = (reminderSettings.presetIds||[]).indexOf(p.id)!==-1;
                    return (
                      <TouchableOpacity key={p.id} onPress={function(){
                        var cur = reminderSettings.presetIds||[];
                        var next = active ? cur.filter(function(x){return x!==p.id;}) : cur.concat([p.id]);
                        updateReminderSettings(Object.assign({},reminderSettings,{presetIds:next}));
                      }} style={[s.freqBtn,active&&{backgroundColor:T.accent,borderColor:T.accent}]}>
                        <Text style={[s.freqBtnTxt,active&&{color:"#fff"}]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={s.carryRow} onPress={function(){ updateReminderSettings(Object.assign({},reminderSettings,{intervalEnabled:!reminderSettings.intervalEnabled})); }}>
                  <View style={[s.circle,{borderColor:T.accent},reminderSettings.intervalEnabled&&{backgroundColor:T.check,borderColor:T.check}]}>
                    {reminderSettings.intervalEnabled?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
                  </View>
                  <View style={{flex:1}}>
                    <Text style={s.carryTitle}>Rappel toutes les X heures</Text>
                    <Text style={s.carrySub}>Entre une heure de debut et de fin</Text>
                  </View>
                </TouchableOpacity>
                {reminderSettings.intervalEnabled ? (
                  <View>
                    <View style={s.row}>
                      <View style={{flex:1}}>
                        <Text style={s.sectionLbl}>Debut</Text>
                        <TextInput style={s.input} placeholder="08:00" placeholderTextColor={T.muted}
                          value={reminderSettings.intervalStart||""} onChangeText={function(v){ updateReminderSettings(Object.assign({},reminderSettings,{intervalStart:v})); }} />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={s.sectionLbl}>Fin</Text>
                        <TextInput style={s.input} placeholder="20:00" placeholderTextColor={T.muted}
                          value={reminderSettings.intervalEnd||""} onChangeText={function(v){ updateReminderSettings(Object.assign({},reminderSettings,{intervalEnd:v})); }} />
                      </View>
                    </View>
                    <Text style={s.sectionLbl}>Intervalle</Text>
                    <View style={s.row}>
                      {[1,2,3,4].map(function(n) {
                        var active = reminderSettings.intervalHours===n;
                        return (
                          <TouchableOpacity key={n} onPress={function(){ updateReminderSettings(Object.assign({},reminderSettings,{intervalHours:n})); }}
                            style={[s.freqBtn,active&&{backgroundColor:T.accent,borderColor:T.accent}]}>
                            <Text style={[s.freqBtnTxt,active&&{color:"#fff"}]}>{n}h</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
          <TouchableOpacity style={[s.btnPrimary,{backgroundColor:T.accent,marginTop:14}]} onPress={function(){ setShowReminders(false); }}>
            <Text style={s.btnPrimaryTxt}>Fermer</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Add Task Modal ── */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={s.overlayBottom}><View style={s.modalBottom}>
          <Text style={s.modalTitle}>Ajouter une tache</Text>
          <TextInput style={s.input} placeholder="Description..." placeholderTextColor={T.muted} value={newLabel} onChangeText={setNewLabel} />
          <TextInput style={s.input} placeholder="Heure (ex: 08:30) — optionnel" placeholderTextColor={T.muted}
            value={newTime} onChangeText={setNewTime} keyboardType="numbers-and-punctuation" />
          <TouchableOpacity style={s.checkRow} onPress={function(){ setNewMeal(!newMeal); }}>
            <View style={[s.circle,{borderColor:T.accent},newMeal&&{backgroundColor:T.check,borderColor:T.check}]}>
              {newMeal?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
            </View>
            <Text style={s.checkTxt}>C'est un repas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.checkRow} onPress={function(){ setNewImportant(!newImportant); }}>
            <View style={[s.circle,{borderColor:T.important},newImportant&&{backgroundColor:T.important,borderColor:T.important}]}>
              {newImportant?<Text style={{color:"#fff",fontSize:11}}>!</Text>:null}
            </View>
            <Text style={s.checkTxt}>Tache importante ❗</Text>
          </TouchableOpacity>
          <Text style={s.sectionLbl}>Frequence</Text>
          <View style={s.row}>
            {FREQ_OPTIONS.map(function(f) {
              var active = newFreq===f.id;
              return (
                <TouchableOpacity key={f.id} onPress={function(){ setNewFreq(f.id); }}
                  style={[s.freqBtn,active&&{backgroundColor:colors.accent,borderColor:colors.accent}]}>
                  <Text style={[s.freqBtnTxt,active&&{color:"#fff"}]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {newFreq==="custom"?(
            <View style={{marginTop:10}}>
              <Text style={s.sectionLbl}>Jours</Text>
              <View style={s.row}>
                {DAYS.map(function(d,i){
                  var sel=newDays.indexOf(d)!==-1;
                  return (
                    <TouchableOpacity key={d} onPress={function(){ setNewDays(function(prev){ return sel?prev.filter(function(x){return x!==d;}):prev.concat([d]); }); }}
                      style={[s.dayBtn,sel&&{backgroundColor:colors.accent,borderColor:colors.accent}]}>
                      <Text style={[s.dayBtnTxt,sel&&{color:"#fff"}]}>{DAY_SHORT[i]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ):null}
          <View style={[s.row,{marginTop:16}]}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowAdd(false); setNewLabel(""); setNewFreq("once"); setNewDays([]); setNewMeal(false); setNewTime(""); setNewImportant(false); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary,{backgroundColor:colors.accent,flex:1}]} onPress={addTask}>
              <Text style={s.btnPrimaryTxt}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={s.overlayBottom}><View style={s.modalBottom}>
          <Text style={s.modalTitle}>Modifier la tache</Text>
          <TextInput style={s.input} value={editLabel} onChangeText={setEditLabel} placeholderTextColor={T.muted} placeholder="Nouveau nom..." autoFocus />
          <TextInput style={s.input} placeholder="Heure (ex: 08:30)" placeholderTextColor={T.muted}
            value={editTime} onChangeText={setEditTime} keyboardType="numbers-and-punctuation" />
          <TouchableOpacity style={s.checkRow} onPress={function(){ setEditImportant(!editImportant); }}>
            <View style={[s.circle,{borderColor:T.important},editImportant&&{backgroundColor:T.important,borderColor:T.important}]}>
              {editImportant?<Text style={{color:"#fff",fontSize:11}}>!</Text>:null}
            </View>
            <Text style={s.checkTxt}>Tache importante ❗</Text>
          </TouchableOpacity>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowEditModal(false); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary,{backgroundColor:colors.accent,flex:1}]} onPress={function(){
              if(!editLabel.trim()) return;
              setPendingEdit({task:editMenu,newLabel:editLabel.trim(),newTime:editTime.trim(),important:editImportant});
              setShowEditModal(false); setShowEditScope(true);
            }}>
              <Text style={s.btnPrimaryTxt}>Suivant</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Edit Scope Modal ── */}
      <Modal visible={showEditScope} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>✏️</Text>
          <Text style={s.modalTitle}>Appliquer a...</Text>
          {pendingEdit?<Text style={s.modalDesc}>"{pendingEdit.newLabel}"</Text>:null}
          <TouchableOpacity style={s.moveBtn} onPress={function(){ applyEdit("once"); }}>
            <View><Text style={s.moveBtnDay}>Seulement aujourd'hui</Text><Text style={s.moveBtnDate}>Cette occurrence uniquement</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ applyEdit("all"); }}>
            <View><Text style={s.moveBtnDay}>Toutes les occurrences</Text><Text style={s.moveBtnDate}>Remplace partout ou cette tache apparait</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnCancel,{marginTop:8}]} onPress={function(){ setShowEditScope(false); setPendingEdit(null); }}>
            <Text style={s.btnCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Move Day Modal ── */}
      <Modal visible={!!moveMenu} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>Deplacer vers...</Text>
          {moveMenu?<Text style={s.modalDesc}>"{moveMenu.label}"</Text>:null}
          {DAYS.map(function(d,i){
            if(d===currentDay) return null;
            return (
              <TouchableOpacity key={d} style={s.moveBtn} onPress={function(){ moveTask(moveMenu.task,i); }}>
                <Text style={s.moveBtnDay}>{d}</Text>
                <Text style={s.moveBtnDate}>{formatDate(getDateForCell(cycleStart,week,i))}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.btnCancel,{marginTop:8}]} onPress={function(){ setMoveMenu(null); }}>
            <Text style={s.btnCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Delete Repeat Modal ── */}
      <Modal visible={showDelRepeat} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🗑️</Text>
          <Text style={s.modalTitle}>Supprimer cette tache ?</Text>
          {delMenu?<Text style={s.modalDesc}>"{delMenu.label}"</Text>:null}
          <TouchableOpacity style={s.moveBtn} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,false); }}>
            <Text style={s.moveBtnDay}>Seulement aujourd'hui</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,true); }}>
            <Text style={s.moveBtnDay}>Toutes les occurrences</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnCancel,{marginTop:8}]} onPress={function(){ setShowDelRepeat(false); setDelMenu(null); }}>
            <Text style={s.btnCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Delete Simple Modal ── */}
      <Modal visible={!!delMenu&&!showDelRepeat} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🗑️</Text>
          <Text style={s.modalTitle}>Supprimer cette tache ?</Text>
          {delMenu?<Text style={s.modalDesc}>"{delMenu.label}"</Text>:null}
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setDelMenu(null); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDanger} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,false); }}>
              <Text style={s.btnDangerTxt}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <Text style={s.headerSub}>Focalis</Text>
          <Text style={s.headerTitle}>{userName ? "Bonjour " + userName + " 👋" : "Mon planning"}</Text>
        </View>
        <View style={{flexDirection:"row",gap:6}}>
          <TouchableOpacity style={s.iconBtn} onPress={function(){ setShowReminders(true); }}>
            <Text style={{fontSize:16}}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dangerBtn} onPress={function(){ setShowClearGeneric(true); }}>
            <Text style={s.dangerBtnTxt}>Vider</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn,{borderColor:T.accent+"44",backgroundColor:"#EBF3FC"}]} onPress={function(){ setShowReset(true); setResetStep(1); }}>
            <Text style={{fontSize:11,color:T.accent,fontWeight:"600"}}>Cycle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Week tabs ── */}
      <View style={s.weekRow}>
        {Array.from({length:WEEKS}).map(function(_,w){
          var wp=getWeekProgress(effectiveProfile,w,state);
          var active=w===week;
          var sd=getDateForCell(cycleStart,w,0);
          return (
            <TouchableOpacity key={w} onPress={function(){ setWeek(w); }}
              style={[s.weekTab,active&&{borderColor:T.accent,borderWidth:2,backgroundColor:"#EBF3FC"}]}>
              <Text style={[s.weekTabTxt,active&&{color:T.accent,fontWeight:"700"}]}>Sem {w+1}</Text>
              <Text style={s.weekTabDate}>{sd.getDate()}/{sd.getMonth()+1}</Text>
              <Text style={s.weekTabProg}>{wp.done}/{wp.total}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Day tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{maxHeight:70,backgroundColor:T.surface}}
        contentContainerStyle={{paddingHorizontal:10,paddingVertical:8,gap:6}}>
        {DAYS.map(function(day,i){
          var p=getProgress(effectiveProfile,week,day,state);
          var isActive=i===dayIdx;
          var isWe=isWeekend(day);
          var acc=isWe?T.weekend:T.accent;
          var allDone=p.done===p.total&&p.total>0;
          var cd=getDateForCell(cycleStart,week,i);
          var isToday=cd.toDateString()===new Date().toDateString();
          return (
            <TouchableOpacity key={day} onPress={function(){ setDayIdx(i); }}
              style={[s.dayTab,
                isActive&&{backgroundColor:acc,borderColor:acc},
                isToday&&!isActive&&{borderColor:T.gold,borderWidth:2},
                allDone&&!isActive&&{backgroundColor:"#F0FFF4"}]}>
              <Text style={[s.dayTabTxt,isActive&&{color:"#fff"}]}>{DAY_SHORT[i]}</Text>
              <Text style={[s.dayTabDate,isActive&&{color:"rgba(255,255,255,0.8)"}]}>{cd.getDate()}</Text>
              <Text style={[s.dayTabProg,isActive&&{color:"rgba(255,255,255,0.8)"}]}>{allDone?"✓":(p.done+"/"+p.total)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Day header ── */}
      <View style={[s.dayHeader,{backgroundColor:colors.bg,borderColor:colors.accent+"33",margin:10,marginBottom:6}]}>
        <View style={{flex:1}}>
          <Text style={[s.dayHeaderTag,{color:colors.accent}]}>{colors.tag}</Text>
          <Text style={s.dayHeaderName}>{currentDay}</Text>
          <Text style={s.dayHeaderDate}>{formatDate(todayDate)}</Text>
        </View>
        <View style={{alignItems:"flex-end"}}>
          <Text style={[s.dayHeaderPct,{color:pct===100?T.check:colors.accent}]}>{pct}%</Text>
          <Text style={{fontSize:11,color:T.muted}}>{prog.done}/{prog.total} taches</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={[s.progressBg,{marginHorizontal:10,marginBottom:6}]}>
        <View style={[s.progressFill,{width:pct+"%",backgroundColor:pct===100?T.check:colors.accent}]} />
      </View>

      {/* ── Task list ── */}
      <ScrollView style={{flex:1}} contentContainerStyle={{padding:10,paddingBottom:Platform.OS==="android"?80:40}}>
        {tasks.map(function(task){
          var key=taskKey(week,currentDay,task.id);
          var isDone=!!checked[key];
          var isMeal=!!task.isMeal;
          var mealKey=key+"-t"; var mealVal=meals[mealKey]||"";
          var isCustom=!!task._custom; var isMovedIn=!!task._movedIn;

          var actions=(
            <View style={{flexDirection:"row",gap:4}}>
              <TouchableOpacity style={[s.actBtn,task.important&&{borderColor:T.important}]} onPress={function(){ toggleImportant(task.id); }}>
                <Text style={{fontSize:12,color:task.important?T.important:T.muted}}>❗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtn} onPress={function(){ handleEditPress(task); }}>
                <Text style={{fontSize:12,color:T.muted}}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtn} onPress={function(){ setMoveMenu({task,label:task.label,taskId:task.id,isCustom}); }}>
                <Text style={{fontSize:12,color:T.muted}}>⇄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtnRed} onPress={function(){ handleDeletePress(task); }}>
                <Text style={{fontSize:12,color:T.danger}}>✕</Text>
              </TouchableOpacity>
            </View>
          );

          if(isMeal){
            return (
              <View key={task.id} style={[s.card,isDone&&s.cardDone,task.important&&s.cardImportant,{borderColor:isDone?"#86EFAC":T.gold+"99"}]}>
                <TouchableOpacity style={s.cardRow} onPress={function(){ toggle(key); }}>
                  <View style={[s.circle,{borderColor:T.gold},isDone&&{backgroundColor:T.check,borderColor:T.check}]}>
                    {isDone?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
                  </View>
                  <View style={{flex:1}}>
                    <Text style={[s.cardLabel,isDone&&s.cardLabelDone]}>
                      {task.important?"❗ ":""}{task.label}
                      {task.time?<Text style={s.cardTime}>  {formatTimeDisplay(task.time)}</Text>:null}
                    </Text>
                    {isMovedIn?<Text style={s.cardMeta}>Deplace depuis {task.movedFrom}</Text>:null}
                    {mealVal?<Text style={s.mealPrev}>{mealVal}</Text>:<Text style={[s.cardMeta,{color:T.gold}]}>Note ce que tu mangeras</Text>}
                  </View>
                  {actions}
                </TouchableOpacity>
                <TextInput style={s.mealInput} placeholder="Ex: Salade cesar..." placeholderTextColor={T.muted}
                  value={mealVal} onChangeText={function(v){ updateMeal(mealKey,v); }} />
              </View>
            );
          }

          return (
            <TouchableOpacity key={task.id} style={[s.card,isDone&&s.cardDone,task.important&&s.cardImportant]} onPress={function(){ toggle(key); }}>
              <View style={s.cardRow}>
                <View style={[s.circle,{borderColor:task.important?T.important:colors.accent},isDone&&{backgroundColor:T.check,borderColor:T.check}]}>
                  {isDone?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
                </View>
                <View style={{flex:1}}>
                  <Text style={[s.cardLabel,isDone&&s.cardLabelDone]}>
                    {task.important?"❗ ":""}{task.label}
                    {task.time?<Text style={s.cardTime}>  {formatTimeDisplay(task.time)}</Text>:null}
                  </Text>
                  {isMovedIn?<Text style={s.cardMeta}>Deplace depuis {task.movedFrom}</Text>:null}
                  {isCustom&&task.freq!=="once"?<Text style={[s.cardMeta,{color:colors.accent}]}>
                    {task.freq==="weekly"?"Repete chaque semaine":"Repete: "+(task.freqDays||[]).join(", ")}
                  </Text>:null}
                </View>
                {actions}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={[s.addBtn,{borderColor:colors.accent}]} onPress={function(){ setShowAdd(true); }}>
          <Text style={[s.addBtnTxt,{color:colors.accent}]}>+ Ajouter une tache</Text>
        </TouchableOpacity>

        {pct===100?(
          <View style={s.doneCard}>
            <Text style={{fontSize:28,marginBottom:6}}>🌟</Text>
            <Text style={s.doneTxt}>Journee complete !</Text>
            <Text style={s.doneSub}>{userName?userName+", bravo pour aujourd'hui !":"Bravo pour aujourd'hui !"}</Text>
          </View>
        ):null}
      </ScrollView>
    </SafeAreaView>
  );
}

