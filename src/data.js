
// ─── Constants ────────────────────────────────────────────────────────────────

export const WEEKS = 4;
export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const FREQ_OPTIONS = [
  { id: "once",   label: "Une fois" },
  { id: "weekly", label: "Toutes les semaines" },
  { id: "custom", label: "Jours specifiques" },
];

export function isWeekend(day) {
  return day === "Samedi" || day === "Dimanche";
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const PROFILES = {
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

export function getProfileTasks(profileId, day) {
  var profile = PROFILES[profileId] || PROFILES.VIERGE;
  var key = isWeekend(day) ? "weekend" : "semaine";
  var list = (profile.tasks && profile.tasks[key]) || [];
  return list.map(function(t) { return Object.assign({}, t); });
}

export function getAllProfileTaskIds(profileId) {
  var profile = PROFILES[profileId] || PROFILES.VIERGE;
  var ids = {};
  Object.keys(profile.tasks || {}).forEach(function(key) {
    (profile.tasks[key] || []).forEach(function(t) { ids[t.id] = true; });
  });
  return ids;
}
