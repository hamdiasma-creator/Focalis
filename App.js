import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, SafeAreaView, StatusBar, Platform, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import DateTimePicker from '@react-native-community/datetimepicker';
import { THEME, makeStyles } from './src/theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://7a71a421a2e1d3f3597087671b80d395@o4511699180257280.ingest.us.sentry.io/4511699182616576',
  debug: false,
  tracesSampleRate: 1.0,
});



// ─── Attrapeur d'erreurs (affiche le crash a l'ecran ET l'envoie a Sentry) ───

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  var __defaultErrorHandler = ErrorUtils.getGlobalHandler ? ErrorUtils.getGlobalHandler() : null;
  ErrorUtils.setGlobalHandler(function (error, isFatal) {
    try { Sentry.captureException(error); } catch (e) {}
    try {
      AsyncStorage.setItem('__last_crash__', JSON.stringify({
        message: (error && error.message) || String(error),
        stack: (error && error.stack) || '',
        isFatal: !!isFatal,
        time: new Date().toISOString(),
      }));
    } catch (e) {}
    if (__defaultErrorHandler) __defaultErrorHandler(error, isFatal);
  });
}

class CrashCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error };
  }
  componentDidCatch(error, info) {
    this.setState({ info: info });
    try { Sentry.captureException(error); } catch (e) {}
    try {
      AsyncStorage.setItem('__last_crash__', JSON.stringify({
        message: (error && error.message) || String(error),
        stack: ((error && error.stack) || '') + '\n' + ((info && info.componentStack) || ''),
        time: new Date().toISOString(),
      }));
    } catch (e) {}
  }
  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: '#DC2626', fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
              Erreur detectee (envoyee a Sentry) :
            </Text>
            <Text selectable style={{ color: '#000', fontSize: 14, marginBottom: 12 }}>
              {String(this.state.error && this.state.error.message)}
            </Text>
            <Text selectable style={{ color: '#444', fontSize: 11 }}>
              {String(this.state.error && this.state.error.stack)}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (e) {}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKS = 4;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const FREQ_OPTIONS = [
  { id: "once",   label: "Une fois" },
  { id: "weekly", label: "Toutes les semaines" },
  { id: "custom", label: "Jours specifiques" },
];

function isWeekend(day) {
  return day === "Samedi" || day === "Dimanche";
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

const PROFILES = {
  ETUDIANT: {
    id: "ETUDIANT",
    label: "Etudiant(e)",
    emoji: "🎓",
    description: "Cours, etudes, revisions et moments de detente.",
    tasks: {
      semaine: [
        { id: "pdt_dej_e",   label: "Petit dejeuner",                 time: "08:00" },
        { id: "repas_midi_e", label: "Repas midi",                    time: "12:30", isMeal: true },
        { id: "etudes_e",    label: "Session d'etude / devoirs",       time: "17:00" },
        { id: "repas_soir_e", label: "Repas soir",                    time: "19:00", isMeal: true },
        { id: "lecture_e",   label: "Lecture ou activite calme",       time: "21:00" },
        { id: "coucher_e",   label: "Routine du coucher",              time: "22:30" },
      ],
      weekend: [
        { id: "pdt_dej_we_e",  label: "Petit dejeuner",               time: "09:30" },
        { id: "sport_we_e",    label: "Sport ou activite physique",    time: "11:00" },
        { id: "repas_midi_we_e", label: "Repas midi",                  time: "13:00", isMeal: true },
        { id: "revisions_we_e", label: "Revisions",                   time: "15:00" },
        { id: "repas_soir_we_e", label: "Repas soir",                 time: "19:00", isMeal: true },
      ],
    },
  },

  BUREAU: {
    id: "BUREAU",
    label: "Travailleur(se) de bureau",
    emoji: "💼",
    description: "Journees au bureau, pauses et routine du soir.",
    tasks: {
      semaine: [
        { id: "pdt_dej_b",    label: "Petit dejeuner",                time: "07:30" },
        { id: "repas_midi_b", label: "Repas midi",                    time: "12:30", isMeal: true },
        { id: "pause_b",      label: "Pause deconnexion apres-midi",   time: "15:30" },
        { id: "repas_soir_b", label: "Repas soir",                    time: "19:00", isMeal: true },
        { id: "detente_b",    label: "Temps de detente",              time: "20:30" },
        { id: "coucher_b",    label: "Routine du coucher",            time: "22:00" },
      ],
      weekend: [
        { id: "pdt_dej_we_b",  label: "Petit dejeuner",              time: "09:00" },
        { id: "repas_midi_we_b", label: "Repas midi",                 time: "12:30", isMeal: true },
        { id: "temps_moi_b",   label: "Temps pour soi",              time: "15:00" },
        { id: "repas_soir_we_b", label: "Repas soir",                time: "19:00", isMeal: true },
      ],
    },
  },

  FAMILLE: {
    id: "FAMILLE",
    label: "Responsable de famille",
    emoji: "👨‍👩‍👧",
    description: "Routine centree sur les enfants et la vie de famille.",
    tasks: {
      semaine: [
        { id: "routine_matin_f", label: "Routine matin des enfants",         time: "07:00" },
        { id: "pdt_dej_f",       label: "Petit dejeuner en famille",         time: "07:30", isMeal: true },
        { id: "repas_midi_f",    label: "Repas midi",                        time: "12:00", isMeal: true },
        { id: "enfants_f",       label: "Temps dedie aux enfants (Devoirs/Jeux)", time: "17:00" },
        { id: "repas_soir_f",    label: "Repas soir en famille",             time: "18:30", isMeal: true },
        { id: "dodo_f",          label: "Routine dodo des enfants",          time: "20:00" },
        { id: "temps_moi_f",     label: "Temps pour soi",                   time: "21:00" },
      ],
      weekend: [
        { id: "pdt_dej_we_f",    label: "Petit dejeuner en famille",        time: "08:30", isMeal: true },
        { id: "activite_we_f",   label: "Activite en famille",              time: "10:30" },
        { id: "repas_midi_we_f", label: "Repas midi",                       time: "12:30", isMeal: true },
        { id: "repas_soir_we_f", label: "Repas soir",                       time: "18:30", isMeal: true },
      ],
    },
  },

  FEMME_ACTIVE: {
    id: "FEMME_ACTIVE",
    label: "Femme active",
    emoji: "💪",
    description: "Equilibre entre sante, bien-etre et vie professionnelle.",
    tasks: {
      semaine: [
        { id: "sport_fa",       label: "Mettre le corps en mouvement (Sport/Yoga)", time: "07:00" },
        { id: "pdt_dej_fa",     label: "Petit dejeuner",                            time: "08:00" },
        { id: "repas_midi_fa",  label: "Repas midi",                                time: "12:30", isMeal: true },
        { id: "repas_soir_fa",  label: "Repas soir",                                time: "19:00", isMeal: true },
        { id: "skincare_fa",    label: "Skincare du soir",                          time: "21:00" },
        { id: "lecture_fa",     label: "Lecture ou detente",                        time: "21:30" },
      ],
      weekend: [
        { id: "sport_we_fa",    label: "Sport ou activite physique",                time: "09:30" },
        { id: "pdt_dej_we_fa",  label: "Petit dejeuner",                            time: "10:30" },
        { id: "repas_midi_we_fa", label: "Repas midi",                              time: "13:00", isMeal: true },
        { id: "temps_moi_fa",   label: "Temps pour moi",                            time: "15:00" },
        { id: "repas_soir_we_fa", label: "Repas soir",                              time: "19:00", isMeal: true },
        { id: "skincare_we_fa", label: "Skincare et routine beaute",                time: "21:00" },
      ],
    },
  },

  RESET: {
    id: "RESET",
    label: "Retour aux bases",
    emoji: "🌀",
    description: "Le minimum essentiel pour prendre soin de toi, sans pression.",
    tasks: {
      semaine: [
        { id: "hydra_r",      label: "S'hydrater (un grand verre d'eau)", time: "08:00" },
        { id: "repas_midi_r", label: "Un repas nourrissant (Midi)",        time: "12:00", isMeal: true },
        { id: "air_r",        label: "Prendre l'air (5 minutes)",          time: "14:00" },
        { id: "micro_r",      label: "Une micro-action (ranger un objet)", time: "16:00" },
        { id: "repas_soir_r", label: "Un repas nourrissant (Soir)",        time: "19:00", isMeal: true },
        { id: "coucher_r",    label: "Routine du coucher (Hygiene & dodo)", time: "21:30" },
      ],
      weekend: [
        { id: "hydra_we_r",      label: "S'hydrater",                          time: "09:00" },
        { id: "repas_midi_we_r", label: "Un repas plaisir (Midi)",             time: "12:30", isMeal: true },
        { id: "douche_we_r",     label: "Prendre une douche",                  time: "14:00" },
        { id: "reconfort_we_r",  label: "Moment reconfortant (Musique/Lecture/Film)", time: "16:00" },
        { id: "repas_soir_we_r", label: "Un repas nourrissant (Soir)",         time: "19:00", isMeal: true },
      ],
    },
  },

  VIERGE: {
    id: "VIERGE",
    label: "Je veux un planning vierge",
    emoji: "📄",
    description: "Aucune tache pre-remplie. Tu construis ton propre planning.",
    tasks: {
      semaine: [],
      weekend: [],
    },
  },
};

function getProfileTasks(profileId, day) {
  var profile = PROFILES[profileId] || PROFILES.VIERGE;
  var key = isWeekend(day) ? "weekend" : "semaine";
  var list = (profile.tasks && profile.tasks[key]) || [];
  return list.map(function(t) { return Object.assign({}, t); });
}

function getAllProfileTaskIds(profileId) {
  var profile = PROFILES[profileId] || PROFILES.VIERGE;
  var ids = {};
  Object.keys(profile.tasks || {}).forEach(function(key) {
    (profile.tasks[key] || []).forEach(function(t) { ids[t.id] = true; });
  });
  return ids;
}

// ─── Storage ────────────────────────────────────────────────────────────────

async function load(key, fallback) {
  try {
    var v = await AsyncStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch (e) { return fallback; }
}

async function save(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function computeCycleStart() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var monBased = (today.getDay() + 6) % 7;
  var monday = new Date(today.getTime());
  monday.setDate(today.getDate() - monBased);
  return monday;
}

function getDateForCell(cycleStart, weekIndex, dayIndex) {
  var d = new Date(cycleStart.getTime());
  d.setDate(d.getDate() + weekIndex * 7 + dayIndex);
  return d;
}

function formatDate(date) {
  var months = ["janvier","fevrier","mars","avril","mai","juin",
                "juillet","aout","septembre","octobre","novembre","decembre"];
  return date.getDate() + " " + months[date.getMonth()];
}

function getCurrentWeekAndDay(cycleStart) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var start = new Date(cycleStart.getTime()); start.setHours(0, 0, 0, 0);
  var diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diff < 0 || diff >= 28) return { week: 0, day: 0 };
  return { week: Math.floor(diff / 7), day: diff % 7 };
}

function cellKey(w, d) { return "w" + w + "-" + d; }
function taskKey(w, d, id) { return "w" + w + "-" + d + "-" + id; }

function timeToMinutes(t) {
  if (!t) return null;
  var parts = t.split(":");
  var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
}

function formatTimeDisplay(t) {
  if (!t) return "";
  var mins = timeToMinutes(t);
  if (mins === null) return t;
  var h = Math.floor(mins / 60), m = mins % 60;
  return (h < 10 ? "0" : "") + h + "h" + (m < 10 ? "0" : "") + m;
}

function timeStringToDate(timeStr) {
  var d = new Date();
  d.setSeconds(0); d.setMilliseconds(0);
  if (timeStr) {
    var parts = timeStr.split(":");
    var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) { d.setHours(h); d.setMinutes(m); }
  }
  return d;
}

function dateToTimeString(d) {
  var h = d.getHours(), m = d.getMinutes();
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

// ─── Task logic ───────────────────────────────────────────────────────────────

function occKey(kind, id, w, day) { return "occ-" + kind + "-" + id + "-w" + w + "-" + day; }

function getTasksForCell(profileId, w, day, state) {
  var customs      = state.customs      || {};
  var moved        = state.moved        || {};
  var taskLocations= state.taskLocations|| {};
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

  // Strings that are NOT skip- markers are hidden base task ids (suppression via "Supprimer")
  var removedIds      = movedArr.filter(function(x) { return typeof x === "string" && x.indexOf("skip-") !== 0; });
  // skip-<id> means: hide this custom task occurrence only today
  var skippedCustomIds= movedArr.filter(function(x) { return typeof x === "string" && x.indexOf("skip-") === 0; }).map(function(x) { return x.slice(5); });

  // Une tache naturelle (base ou personnalisee) est cachee ici si elle a ete DEPLACEE ailleurs
  // (source unique de verite : taskLocations, cle par occurrence d'origine)
  var filtered = base.filter(function(t) {
    if (removedIds.indexOf(t.id) !== -1) return false;
    if (taskLocations[occKey("b", t.id, w, day)]) return false; // deplacee ailleurs
    return true;
  });

  // ── Custom tasks ──────────────────────────────────────────────────────────
  var customArr = [];
  Object.keys(customs).forEach(function(key) {
    (customs[key] || []).forEach(function(task) {
      if (skippedCustomIds.indexOf(task.id) !== -1) return;
      if (taskLocations[occKey("c", task.id, w, day)]) return; // deplacee ailleurs
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

  // ── Taches deplacees VERS cette cellule (une seule entree par occurrence d'origine) ──
  var movedInArr = [];
  Object.keys(taskLocations).forEach(function(k) {
    var loc = taskLocations[k];
    if (loc.toWeek === w && loc.toDay === day) {
      movedInArr.push(Object.assign({}, loc.task, { _movedIn: true, movedFrom: loc.movedFrom, _occKey: k }));
    }
  });

  var all = filtered
    .concat(movedInArr)
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

function getProgress(profileId, w, day, state) {
  var tasks = getTasksForCell(profileId, w, day, state);
  var done  = tasks.filter(function(t) { return !!state.checked[taskKey(w, day, t.id)]; }).length;
  return { done: done, total: tasks.length };
}

function getWeekProgress(profileId, w, state) {
  return DAYS.reduce(function(acc, day) {
    var p = getProgress(profileId, w, day, state);
    return { done: acc.done + p.done, total: acc.total + p.total };
  }, { done: 0, total: 0 });
}

function buildClearedMoved(profileId, moved) {
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

// ─── Theme / styles (voir src/theme.js) ─────────────────────────────────────

const T = THEME;
const s = makeStyles(T);  // Calculated once, outside component
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

// Messages de bienveillance — varies mais stables pour une journee donnee (pas de re-tirage a chaque render)
const DONE_MESSAGES = [
  "Tu as pris soin de toi aujourd'hui.",
  "Chaque petite chose comptait, et tu les as faites.",
  "Journee cochee. Repose-toi, tu l'as merite.",
  "Regarde tout ce que tu as accompli.",
  "Pas a pas, tu avances — et ca se voit.",
];
const EMPTY_DAY_MESSAGES = [
  "Rien de prevu ici. Une pause, ca fait aussi partie du plan.",
  "Journee libre. Ajoute seulement ce dont tu as vraiment besoin.",
  "Pas de taches pour l'instant — c'est ok aussi.",
];
function pickByDate(list, date) {
  var d = date || new Date();
  var seed = d.getFullYear()*1000 + Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
  return list[seed % list.length];
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  // Chargement de la police Lexend depuis des fichiers locaux
  // (contourne le bug de resolution Snack avec @expo-google-fonts/lexend)
  const [fontsLoaded] = useFonts({
    Lexend_400Regular: require('./assets/fonts/Lexend-Regular.ttf'),
    Lexend_500Medium: require('./assets/fonts/Lexend-Medium.ttf'),
    Lexend_600SemiBold: require('./assets/fonts/Lexend-SemiBold.ttf'),
    Lexend_700Bold: require('./assets/fonts/Lexend-Bold.ttf'),
    Lexend_800ExtraBold: require('./assets/fonts/Lexend-ExtraBold.ttf'),
  });

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
  const [taskLocations, setTaskLocations] = useState({}); // source unique de verite pour les taches deplacees

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
  const [showNewTimePicker, setShowNewTimePicker]  = useState(false);
  const [newImportant,      setNewImportant]      = useState(false);
  const [moveMenu,          setMoveMenu]          = useState(null);
  const [moveAmbiguous,     setMoveAmbiguous]     = useState(null); // { task, targetDayIdx, thisWeek, nextWeek }
  const [delMenu,           setDelMenu]           = useState(null);
  const [showDelRepeat,     setShowDelRepeat]     = useState(false);
  const [editMenu,          setEditMenu]          = useState(null);
  const [editLabel,         setEditLabel]         = useState("");
  const [editTime,          setEditTime]          = useState("");
  const [showEditTimePicker,setShowEditTimePicker] = useState(false);
  const [editImportant,     setEditImportant]     = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [showEditScope,     setShowEditScope]     = useState(false);
  const [pendingEdit,       setPendingEdit]       = useState(null);
  const [showReminders,     setShowReminders]     = useState(false);
  const [reminderSettings,  setReminderSettings]  = useState(DEFAULT_REMINDER);

  // Listes persistantes (courses / voyage) — independantes du cycle, jamais reinitialisees
  const [groceries,         setGroceries]         = useState([]);
  const [travelItems,       setTravelItems]       = useState([]);
  const [showGroceries,     setShowGroceries]     = useState(false);
  const [showTravel,        setShowTravel]        = useState(false);
  const [newGroceryText,    setNewGroceryText]    = useState("");
  const [newTravelText,     setNewTravelText]     = useState("");
  const [showClearGroceries,setShowClearGroceries]= useState(false);
  const [showClearTravel,   setShowClearTravel]   = useState(false);

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
        load("groceries", []), load("travelItems", []), load("taskLocations", {}),
      ]).then(function (r) {
        try {
          setChecked(r[0]); setMeals(r[1]); setCustoms(r[2]); setMoved(r[3]);
          var savedName = r[4]; var savedProfile = r[5];
          setTaskOverrides(r[6]); setTaskTimes(r[7]); setImportant(r[8]);
          setReminderSettings(r[10] || DEFAULT_REMINDER);
          setGroceries(r[11] || []); setTravelItems(r[12] || []);
          setTaskLocations(r[13] || {});

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

  // Valeur animee de defilement — pilote le retrecissement de l'en-tete (semaines/jours/progression)
  const scrollY = useRef(new Animated.Value(0)).current;

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
  var state = { checked, meals, customs, moved, taskOverrides, taskTimes, important, taskLocations };

  var currentDay = DAYS[dayIdx];
  var colors = isWeekend(currentDay)
    ? { bg: "#EEEDF8", accent: T.weekend, tag: "Weekend" }
    : { bg: "#EBF3FC", accent: T.accent,  tag: "Journee" };

  var tasks   = getTasksForCell(effectiveProfile, week, currentDay, state);
  var prog    = getProgress(effectiveProfile, week, currentDay, state);
  var pct     = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  var todayDate = getDateForCell(cycleStart || computeCycleStart(), week, dayIdx);
  var todayWD  = getCurrentWeekAndDay(cycleStart || computeCycleStart());
  var todayAbs = todayWD.week * 7 + todayWD.day;
  var viewedAbs = week * 7 + dayIdx;

  // ── Interpolations pour l'en-tete retractable au defilement ──
  var weekRowHeight = scrollY.interpolate({ inputRange:[0,70], outputRange:[52,0], extrapolate:"clamp" });
  var weekRowOpacity = scrollY.interpolate({ inputRange:[0,40], outputRange:[1,0], extrapolate:"clamp" });
  var dayHeaderPadV = scrollY.interpolate({ inputRange:[0,70], outputRange:[8,3], extrapolate:"clamp" });
  var dayHeaderNameSize = scrollY.interpolate({ inputRange:[0,70], outputRange:[16,13], extrapolate:"clamp" });
  var dayHeaderPctSize = scrollY.interpolate({ inputRange:[0,70], outputRange:[18,14], extrapolate:"clamp" });
  var subInfoOpacity = scrollY.interpolate({ inputRange:[0,50], outputRange:[1,0], extrapolate:"clamp" });
  var subInfoHeight = scrollY.interpolate({ inputRange:[0,50], outputRange:[16,0], extrapolate:"clamp" });
  var progressBarHeight = scrollY.interpolate({ inputRange:[0,70], outputRange:[5,0], extrapolate:"clamp" });
  var progressBarMargin = scrollY.interpolate({ inputRange:[0,70], outputRange:[6,0], extrapolate:"clamp" });

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

  async function deleteTask(taskId, isCustom, sourceKey, deleteAll, movedOccKey) {
    if (movedOccKey) {
      // Tache actuellement affichee suite a un deplacement : on la cache partout,
      // sans reactiver son emplacement d'origine (qui reste marque "deplacee").
      var nextTL = Object.assign({}, taskLocations);
      if (nextTL[movedOccKey]) nextTL[movedOccKey] = Object.assign({}, nextTL[movedOccKey], { toWeek: null, toDay: null });
      setTaskLocations(nextTL); await save("taskLocations", nextTL);
      setDelMenu(null); setShowDelRepeat(false);
      return;
    }
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
    setDelMenu({ taskId: task.id, label: task.label, isCustom, sourceKey: task._sourceKey || cellKey(week, DAYS[dayIdx]), isRepeat, movedOccKey: task._occKey || null });
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

  // Deplace effectivement une tache vers (targetWeek, targetDayIdx).
  // Reutilise la MEME entree si la tache etait deja deplacee (evite les doublons/copies).
  async function commitMove(task, targetWeek, targetDayIdx) {
    var srcDay = DAYS[dayIdx];
    var key = task._occKey || occKey(task._custom ? "c" : "b", task.id, week, srcDay);
    var snapshot = {
      id: task.id, label: task.label, time: task.time, isMeal: !!task.isMeal,
      freq: task.freq, freqDays: task.freqDays, _custom: !!task._custom,
    };
    var next = Object.assign({}, taskLocations);
    next[key] = { toWeek: targetWeek, toDay: DAYS[targetDayIdx], movedFrom: srcDay, task: snapshot };
    setTaskLocations(next); await save("taskLocations", next);
    setMoveMenu(null); setMoveAmbiguous(null);
  }

  // Determine automatiquement la semaine cible, ou demande confirmation si ambigu.
  function requestMove(task, targetDayIdx) {
    var todayWD = getCurrentWeekAndDay(cycleStart);
    var todayAbs = todayWD.week * 7 + todayWD.day;
    var viewedAbs = week * 7 + dayIdx;
    var candidateThisWeekAbs = week * 7 + targetDayIdx;

    if (candidateThisWeekAbs < todayAbs) {
      // Ce jour est deja passe cette semaine -> automatiquement la semaine prochaine
      commitMove(task, Math.min(week + 1, WEEKS - 1), targetDayIdx);
    } else if (candidateThisWeekAbs > viewedAbs) {
      // Ce jour arrive apres le jour consulte -> automatiquement cette semaine, pas d'ambiguite
      commitMove(task, week, targetDayIdx);
    } else {
      // Cas ambigu : entre aujourd'hui et le jour consulte -> on demande
      setMoveAmbiguous({ task: task, targetDayIdx: targetDayIdx, thisWeek: week, nextWeek: Math.min(week + 1, WEEKS - 1) });
    }
  }

  async function clearGenericTasks() {
    var next = buildClearedMoved(effectiveProfile, moved);
    setMoved(next); await save("mv", next);
    // Une tache "videe" ne doit garder ni son ancien emplacement deplace, ni son statut importante/heure modifiee
    setTaskLocations({}); await save("taskLocations", {});
    setImportant({}); await save("important", {});
    setTaskTimes({}); await save("taskTimes", {});
    setShowClearGeneric(false);
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
    // Un nouveau cycle repart a zero : pas d'emplacements deplaces, pas d'importance heritee,
    // pas d'heures modifiees d'un cycle precedent — meme pour les taches personnalisees importees.
    setTaskLocations({}); setImportant({}); setTaskTimes({});
    setProfileId(newProfile); await save("profileId", newProfile);
    await Promise.all([
      save("ac",newChecked), save("am",newMeals), save("mv",newMoved), save("cu",newCustoms),
      save("taskOverrides",{}), save("taskLocations",{}), save("important",{}), save("taskTimes",{}),
    ]);
    setShowReset(false); setResetStep(1); setPendingProfileId(null); setCarryCustoms(false);
  }

  async function updateReminderSettings(next) {
    setReminderSettings(next); await save("reminderSettings", next);
  }

  // ─── Listes persistantes (courses / voyage) ────────────────────────────────

  async function addGroceryItem() {
    if (!newGroceryText.trim()) return;
    var item = { id: "g" + Date.now(), label: newGroceryText.trim(), checked: false };
    var next = groceries.concat([item]);
    setGroceries(next); await save("groceries", next);
    setNewGroceryText("");
  }

  async function toggleGroceryItem(id) {
    var next = groceries.map(function(it){ return it.id===id ? Object.assign({},it,{checked:!it.checked}) : it; });
    setGroceries(next); await save("groceries", next);
  }

  async function deleteGroceryItem(id) {
    var next = groceries.filter(function(it){ return it.id!==id; });
    setGroceries(next); await save("groceries", next);
  }

  async function clearGroceries() {
    setGroceries([]); await save("groceries", []); setShowClearGroceries(false);
  }

  async function addTravelItem() {
    if (!newTravelText.trim()) return;
    var item = { id: "t" + Date.now(), label: newTravelText.trim(), checked: false };
    var next = travelItems.concat([item]);
    setTravelItems(next); await save("travelItems", next);
    setNewTravelText("");
  }

  async function toggleTravelItem(id) {
    var next = travelItems.map(function(it){ return it.id===id ? Object.assign({},it,{checked:!it.checked}) : it; });
    setTravelItems(next); await save("travelItems", next);
  }

  async function deleteTravelItem(id) {
    var next = travelItems.filter(function(it){ return it.id!==id; });
    setTravelItems(next); await save("travelItems", next);
  }

  async function clearTravel() {
    setTravelItems([]); await save("travelItems", []); setShowClearTravel(false);
  }

  // Tri Keep-style : non coches d'abord (ordre d'ajout), coches ensuite en bas
  function sortedList(items) {
    var unchecked = items.filter(function(it){ return !it.checked; });
    var checked   = items.filter(function(it){ return it.checked; });
    return unchecked.concat(checked);
  }

  // ─── Render guard ──────────────────────────────────────────────────────────

  if (!ready || !cycleStart || !fontsLoaded) {
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
                  <Text style={{ color:"#fff", fontFamily:"Lexend_700Bold", fontSize:14 }}>Continuer →</Text>
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
                  <Text style={{ color:"#fff", fontFamily:"Lexend_700Bold", fontSize:14 }}>Commencer ✓</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Reset Modal (un seul Modal natif pour toutes les étapes — évite le bug de repaint Android au changement d'étape) ── */}
      <Modal visible={showReset} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          {resetStep===1 ? (
            <>
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
            </>
          ) : null}

          {resetStep===2 ? (
            <>
              <Text style={s.modalEmoji}>👤</Text>
              <Text style={s.modalTitle}>Changer de profil ?</Text>
              <Text style={s.modalDesc}>Ton profil actuel est "{(PROFILES[effectiveProfile]||PROFILES.VIERGE).label}".</Text>
              <TouchableOpacity style={s.moveBtn} onPress={function(){ setPendingProfileId(null); setResetStep(3); }}>
                <Text style={s.moveBtnDay}>Garder mon profil actuel</Text>
                <Text style={{ color:T.muted }}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.moveBtn} onPress={function(){ setPendingProfileId("__pick__"); setResetStep(25); }}>
                <Text style={s.moveBtnDay}>Changer de profil</Text>
                <Text style={{ color:T.muted }}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnCancel,{marginTop:8,flex:0}]} onPress={function(){ setShowReset(false); setResetStep(1); }}>
                <Text style={s.btnCancelTxt}>Annuler</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {resetStep===25 ? (
            <>
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
            </>
          ) : null}

          {resetStep===3 ? (
            <>
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
            </>
          ) : null}
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
          <View style={{flexDirection:"row",gap:8,marginBottom:12}}>
            <TouchableOpacity style={[s.input,{flex:1,marginBottom:0,justifyContent:"center"}]} onPress={function(){ setShowNewTimePicker(true); }}>
              <Text style={{fontSize:14,fontFamily:"Lexend_400Regular",color:newTime?T.text:T.muted}}>
                {newTime ? ("🕐 "+formatTimeDisplay(newTime)) : "Heure (optionnel)"}
              </Text>
            </TouchableOpacity>
            {newTime ? (
              <TouchableOpacity style={[s.actBtnRed,{justifyContent:"center"}]} onPress={function(){ setNewTime(""); }}>
                <Text style={{color:T.danger,fontSize:12}}>Retirer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {showNewTimePicker ? (
            <DateTimePicker
              value={timeStringToDate(newTime)}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={function(event, selectedDate){
                setShowNewTimePicker(false);
                if (event.type === "set" && selectedDate) setNewTime(dateToTimeString(selectedDate));
              }}
            />
          ) : null}
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
          <View style={{flexDirection:"row",gap:8,marginBottom:12}}>
            <TouchableOpacity style={[s.input,{flex:1,marginBottom:0,justifyContent:"center"}]} onPress={function(){ setShowEditTimePicker(true); }}>
              <Text style={{fontSize:14,fontFamily:"Lexend_400Regular",color:editTime?T.text:T.muted}}>
                {editTime ? ("🕐 "+formatTimeDisplay(editTime)) : "Heure (optionnel)"}
              </Text>
            </TouchableOpacity>
            {editTime ? (
              <TouchableOpacity style={[s.actBtnRed,{justifyContent:"center"}]} onPress={function(){ setEditTime(""); }}>
                <Text style={{color:T.danger,fontSize:12}}>Retirer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {showEditTimePicker ? (
            <DateTimePicker
              value={timeStringToDate(editTime)}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={function(event, selectedDate){
                setShowEditTimePicker(false);
                if (event.type === "set" && selectedDate) setEditTime(dateToTimeString(selectedDate));
              }}
            />
          ) : null}
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
          <TouchableOpacity style={[s.btnCancel,{marginTop:8,flex:0}]} onPress={function(){ setShowEditScope(false); setPendingEdit(null); }}>
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
            var candidateThisWeekAbs = week*7+i;
            var isAmbiguous = candidateThisWeekAbs >= todayAbs && candidateThisWeekAbs <= viewedAbs;
            var previewWeek = candidateThisWeekAbs < todayAbs ? Math.min(week+1,WEEKS-1) : week;
            var previewLabel = isAmbiguous ? "Cette semaine ou la prochaine ?" : formatDate(getDateForCell(cycleStart,previewWeek,i));
            return (
              <TouchableOpacity key={d} style={s.moveBtn} onPress={function(){ requestMove(moveMenu.task,i); }}>
                <Text style={s.moveBtnDay}>{d}</Text>
                <Text style={s.moveBtnDate}>{previewLabel}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.btnCancel,{marginTop:8,flex:0}]} onPress={function(){ setMoveMenu(null); }}>
            <Text style={s.btnCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* ── Move Ambiguous Week Modal ── */}
      <Modal visible={!!moveAmbiguous} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🤔</Text>
          <Text style={s.modalTitle}>Quelle semaine ?</Text>
          {moveAmbiguous?<Text style={s.modalDesc}>Deplacer vers {DAYS[moveAmbiguous.targetDayIdx]} — cette semaine ou la semaine prochaine ?</Text>:null}
          <TouchableOpacity style={s.moveBtn} onPress={function(){ commitMove(moveAmbiguous.task, moveAmbiguous.thisWeek, moveAmbiguous.targetDayIdx); }}>
            <View>
              <Text style={s.moveBtnDay}>Cette semaine</Text>
              {moveAmbiguous?<Text style={s.moveBtnDate}>{formatDate(getDateForCell(cycleStart,moveAmbiguous.thisWeek,moveAmbiguous.targetDayIdx))}</Text>:null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ commitMove(moveAmbiguous.task, moveAmbiguous.nextWeek, moveAmbiguous.targetDayIdx); }}>
            <View>
              <Text style={s.moveBtnDay}>Semaine prochaine</Text>
              {moveAmbiguous?<Text style={s.moveBtnDate}>{formatDate(getDateForCell(cycleStart,moveAmbiguous.nextWeek,moveAmbiguous.targetDayIdx))}</Text>:null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnCancel,{marginTop:8,flex:0}]} onPress={function(){ setMoveAmbiguous(null); }}>
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
          <TouchableOpacity style={s.moveBtn} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,false,delMenu.movedOccKey); }}>
            <Text style={s.moveBtnDay}>Seulement aujourd'hui</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moveBtn} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,true,delMenu.movedOccKey); }}>
            <Text style={s.moveBtnDay}>Toutes les occurrences</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnCancel,{marginTop:8,flex:0}]} onPress={function(){ setShowDelRepeat(false); setDelMenu(null); }}>
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
            <TouchableOpacity style={s.btnDanger} onPress={function(){ deleteTask(delMenu.taskId,delMenu.isCustom,delMenu.sourceKey,false,delMenu.movedOccKey); }}>
              <Text style={s.btnDangerTxt}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Liste de courses ── */}
      <Modal visible={showGroceries} transparent animationType="slide">
        <View style={s.overlayBottom}>
          <View style={[s.modalBottom,{height:"85%"}]}>
            <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Text style={s.modalTitle}>🛒 Liste de courses</Text>
              <TouchableOpacity onPress={function(){ setShowGroceries(false); }}>
                <Text style={{fontSize:20,color:T.muted}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{flex:1}}>
              {groceries.length===0?<Text style={{color:T.muted,textAlign:"center",marginTop:30}}>Liste vide</Text>:null}
              {sortedList(groceries).map(function(item){
                return (
                  <View key={item.id} style={s.listItemRow}>
                    <TouchableOpacity onPress={function(){ toggleGroceryItem(item.id); }} style={[s.circle,{borderColor:T.accent},item.checked&&{backgroundColor:T.check,borderColor:T.check}]}>
                      {item.checked?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
                    </TouchableOpacity>
                    <Text style={[s.listItemLabel,item.checked&&s.listItemLabelDone]} onPress={function(){ toggleGroceryItem(item.id); }}>{item.label}</Text>
                    <TouchableOpacity onPress={function(){ deleteGroceryItem(item.id); }}>
                      <Text style={{color:T.danger,fontSize:14}}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <View style={s.listAddRow}>
              <TextInput style={s.listInput} placeholder="Ajouter un article..." placeholderTextColor={T.muted}
                value={newGroceryText} onChangeText={setNewGroceryText} onSubmitEditing={addGroceryItem} returnKeyType="done" />
              <TouchableOpacity style={[s.listAddBtn,{backgroundColor:T.accent}]} onPress={addGroceryItem}>
                <Text style={{color:"#fff",fontSize:20,fontFamily:"Lexend_700Bold"}}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btnDanger,{marginTop:8,flex:0}]} onPress={function(){ setShowClearGroceries(true); }}>
              <Text style={s.btnDangerTxt}>Vider la liste</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearGroceries} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🗑️</Text>
          <Text style={s.modalTitle}>Vider la liste de courses ?</Text>
          <Text style={s.modalDesc}>Tous les articles seront supprimes definitivement.</Text>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowClearGroceries(false); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDanger} onPress={clearGroceries}>
              <Text style={s.btnDangerTxt}>Vider</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ── Liste de voyage ── */}
      <Modal visible={showTravel} transparent animationType="slide">
        <View style={s.overlayBottom}>
          <View style={[s.modalBottom,{height:"85%"}]}>
            <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Text style={s.modalTitle}>✈️ Liste de voyage</Text>
              <TouchableOpacity onPress={function(){ setShowTravel(false); }}>
                <Text style={{fontSize:20,color:T.muted}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{flex:1}}>
              {travelItems.length===0?<Text style={{color:T.muted,textAlign:"center",marginTop:30}}>Liste vide</Text>:null}
              {sortedList(travelItems).map(function(item){
                return (
                  <View key={item.id} style={s.listItemRow}>
                    <TouchableOpacity onPress={function(){ toggleTravelItem(item.id); }} style={[s.circle,{borderColor:T.accent},item.checked&&{backgroundColor:T.check,borderColor:T.check}]}>
                      {item.checked?<Text style={{color:"#fff",fontSize:11}}>✓</Text>:null}
                    </TouchableOpacity>
                    <Text style={[s.listItemLabel,item.checked&&s.listItemLabelDone]} onPress={function(){ toggleTravelItem(item.id); }}>{item.label}</Text>
                    <TouchableOpacity onPress={function(){ deleteTravelItem(item.id); }}>
                      <Text style={{color:T.danger,fontSize:14}}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <View style={s.listAddRow}>
              <TextInput style={s.listInput} placeholder="Ajouter un article..." placeholderTextColor={T.muted}
                value={newTravelText} onChangeText={setNewTravelText} onSubmitEditing={addTravelItem} returnKeyType="done" />
              <TouchableOpacity style={[s.listAddBtn,{backgroundColor:T.accent}]} onPress={addTravelItem}>
                <Text style={{color:"#fff",fontSize:20,fontFamily:"Lexend_700Bold"}}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btnDanger,{marginTop:8,flex:0}]} onPress={function(){ setShowClearTravel(true); }}>
              <Text style={s.btnDangerTxt}>Vider la liste</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearTravel} transparent animationType="fade">
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalEmoji}>🗑️</Text>
          <Text style={s.modalTitle}>Vider la liste de voyage ?</Text>
          <Text style={s.modalDesc}>Tous les articles seront supprimes definitivement.</Text>
          <View style={s.row}>
            <TouchableOpacity style={s.btnCancel} onPress={function(){ setShowClearTravel(false); }}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDanger} onPress={clearTravel}>
              <Text style={s.btnDangerTxt}>Vider</Text>
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
            <Text style={{fontSize:11,color:T.accent,fontFamily:"Lexend_600SemiBold"}}>Nouveau cycle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Listes persistantes ── */}
      <View style={s.listsRow}>
        <TouchableOpacity style={s.listBtn} onPress={function(){ setShowGroceries(true); }}>
          <Text style={s.listBtnEmoji}>🛒</Text>
          <Text style={s.listBtnTxt}>Courses{groceries.filter(function(it){return !it.checked;}).length>0?" ("+groceries.filter(function(it){return !it.checked;}).length+")":""}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.listBtn} onPress={function(){ setShowTravel(true); }}>
          <Text style={s.listBtnEmoji}>✈️</Text>
          <Text style={s.listBtnTxt}>Voyage{travelItems.filter(function(it){return !it.checked;}).length>0?" ("+travelItems.filter(function(it){return !it.checked;}).length+")":""}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Week tabs (retractable au defilement) ── */}
      <Animated.View style={[s.weekRow,{height:weekRowHeight,opacity:weekRowOpacity,overflow:"hidden"}]}>
        {Array.from({length:WEEKS}).map(function(_,w){
          var active=w===week;
          return (
            <TouchableOpacity key={w} onPress={function(){ setWeek(w); }}
              style={[s.weekTab,active&&{borderColor:T.accent,borderWidth:2,backgroundColor:"#EBF3FC"}]}>
              <Text style={[s.weekTabTxt,active&&{color:T.accent,fontFamily:"Lexend_700Bold"}]}>Semaine {w+1}</Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

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
              <Text style={[s.dayTabDate,isActive&&{color:"rgba(255,255,255,0.8)"}]}>{(cd.getDate()<10?"0":"")+cd.getDate()}/{(cd.getMonth()+1<10?"0":"")+(cd.getMonth()+1)}</Text>
              {allDone?<Text style={[s.dayTabProg,isActive&&{color:"rgba(255,255,255,0.8)"}]}>✓</Text>:null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Day header (retractable au defilement) ── */}
      <Animated.View style={[s.dayHeader,{backgroundColor:colors.bg,borderColor:colors.accent+"33",margin:10,marginBottom:6,paddingVertical:dayHeaderPadV}]}>
        <View style={{flex:1}}>
          <Animated.Text style={[s.dayHeaderTag,{color:colors.accent,opacity:subInfoOpacity,height:subInfoHeight}]}>{colors.tag}</Animated.Text>
          <Animated.Text style={[s.dayHeaderName,{fontSize:dayHeaderNameSize}]}>{currentDay}</Animated.Text>
          <Animated.Text style={[s.dayHeaderDate,{opacity:subInfoOpacity,height:subInfoHeight}]}>{formatDate(todayDate)}</Animated.Text>
        </View>
        <View style={{alignItems:"flex-end"}}>
          <Animated.Text style={[s.dayHeaderPct,{color:pct===100?T.check:colors.accent,fontSize:dayHeaderPctSize}]}>{pct}%</Animated.Text>
          <Animated.Text style={{fontSize:11,color:T.muted,fontFamily:"Lexend_400Regular",opacity:subInfoOpacity,height:subInfoHeight}}>{prog.done}/{prog.total} taches</Animated.Text>
        </View>
      </Animated.View>

      {/* ── Progress bar (retractable au defilement) ── */}
      <Animated.View style={[s.progressBg,{marginHorizontal:10,marginBottom:progressBarMargin,height:progressBarHeight,overflow:"hidden"}]}>
        <View style={[s.progressFill,{width:pct+"%",backgroundColor:pct===100?T.check:colors.accent,height:"100%"}]} />
      </Animated.View>

      {/* ── Task list ── */}
      <Animated.ScrollView style={{flex:1}} contentContainerStyle={{padding:10,paddingBottom:Platform.OS==="android"?80:40}}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:false})}
        scrollEventThrottle={16}>
        {tasks.map(function(task){
          var key=taskKey(week,currentDay,task.id);
          var isDone=!!checked[key];
          var isMeal=!!task.isMeal;
          var mealKey=key+"-t"; var mealVal=meals[mealKey]||"";
          var isCustom=!!task._custom; var isMovedIn=!!task._movedIn;

          var actions=(
            <View style={{flexDirection:"row",gap:6}}>
              <TouchableOpacity style={[s.actBtn,task.important&&{borderColor:T.important}]} onPress={function(){ toggleImportant(task.id); }}>
                <Text style={{fontSize:19,color:task.important?T.important:T.muted}}>❗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtn} onPress={function(){ handleEditPress(task); }}>
                <Text style={{fontSize:19,color:T.muted}}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtn} onPress={function(){ setMoveMenu({task,label:task.label,taskId:task.id,isCustom}); }}>
                <Text style={{fontSize:19,color:T.muted}}>⇄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actBtnRed} onPress={function(){ handleDeletePress(task); }}>
                <Text style={{fontSize:19,color:T.danger}}>✕</Text>
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

        {tasks.length===0?(
          <View style={[s.doneCard,{backgroundColor:T.bg,borderColor:T.border}]}>
            <Text style={{fontSize:24,marginBottom:6}}>🌤️</Text>
            <Text style={[s.doneSub,{textAlign:"center"}]}>{pickByDate(EMPTY_DAY_MESSAGES, todayDate)}</Text>
          </View>
        ):null}

        <TouchableOpacity style={[s.addBtn,{borderColor:colors.accent}]} onPress={function(){ setShowAdd(true); }}>
          <Text style={[s.addBtnTxt,{color:colors.accent}]}>+ Ajouter une tache</Text>
        </TouchableOpacity>

        {pct===100?(
          <View style={s.doneCard}>
            <Text style={{fontSize:28,marginBottom:6}}>🌟</Text>
            <Text style={s.doneTxt}>Journee complete !</Text>
            <Text style={s.doneSub}>{userName?userName+", "+pickByDate(DONE_MESSAGES, todayDate).charAt(0).toLowerCase()+pickByDate(DONE_MESSAGES, todayDate).slice(1):pickByDate(DONE_MESSAGES, todayDate)}</Text>
          </View>
        ):null}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

export default Sentry.wrap(function App() {
  return (
    <CrashCatcher>
      <AppInner />
    </CrashCatcher>
  );
});
