import { StyleSheet, Platform, StatusBar } from 'react-native';

export const THEME = {
  bg:       "#EEF4FB",
  surface:  "#FFFFFF",
  accent:   "#1A6EC4",
  accentLight: "#4B9FE8",
  accentDark:  "#0D3D7A",
  text:     "#1B2733",
  muted:    "#637687",
  border:   "#D0DEF0",
  check:    "#2F9E6E",
  important:"#D9425A",
  danger:   "#DC2626",
  gold:     "#B5860D",
  weekend:  "#6678C2",
};

export function makeStyles(T) {
  return StyleSheet.create({
    // ── Layout ──────────────────────────────────────────────────────────────
    overlay:       { flex:1, backgroundColor:"rgba(0,0,0,0.52)", justifyContent:"center", alignItems:"center", padding:20 },
    overlayBottom: { flex:1, backgroundColor:"rgba(0,0,0,0.52)", justifyContent:"flex-end" },
    modal:         { backgroundColor:T.surface, borderRadius:18, padding:22, width:"100%" },
    modalBottom:   { backgroundColor:T.surface, borderRadius:18, padding:22 },
    modalEmoji:    { fontSize:32, textAlign:"center", marginBottom:10 },
    modalTitle:    { fontSize:17, fontWeight:"700", textAlign:"center", marginBottom:8, color:T.text },
    modalDesc:     { fontSize:13, color:T.muted, textAlign:"center", lineHeight:20, marginBottom:16 },
    row:           { flexDirection:"row", gap:8, flexWrap:"wrap" },

    // ── Buttons ─────────────────────────────────────────────────────────────
    btnCancel:    { flex:1, padding:12, borderWidth:1, borderColor:T.border, borderRadius:10, alignItems:"center" },
    btnCancelTxt: { fontSize:14, color:T.text },
    btnDanger:    { flex:1, padding:12, backgroundColor:T.danger, borderRadius:10, alignItems:"center" },
    btnDangerTxt: { fontSize:14, color:"#fff", fontWeight:"700" },
    btnPrimary:   { padding:14, borderRadius:12, alignItems:"center" },
    btnPrimaryTxt:{ fontSize:14, color:"#fff", fontWeight:"700" },

    // ── Form ────────────────────────────────────────────────────────────────
    input:      { borderWidth:1, borderColor:T.border, borderRadius:10, padding:11, fontSize:14, color:T.text, marginBottom:12 },
    checkRow:   { flexDirection:"row", alignItems:"center", gap:10, marginBottom:12 },
    checkTxt:   { fontSize:13, color:T.text },
    sectionLbl: { fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:6 },
    freqBtn:    { paddingVertical:7, paddingHorizontal:12, borderRadius:20, borderWidth:1, borderColor:T.border },
    freqBtnTxt: { fontSize:12, color:T.text },
    dayBtn:     { paddingVertical:6, paddingHorizontal:8, borderRadius:8, borderWidth:1, borderColor:T.border },
    dayBtnTxt:  { fontSize:11, color:T.text },

    // ── Misc cards / rows ───────────────────────────────────────────────────
    moveBtn:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", padding:13, borderWidth:1, borderColor:T.border, borderRadius:12, marginBottom:6, backgroundColor:T.bg },
    moveBtnDay:  { fontSize:14, color:T.text, fontWeight:"600" },
    moveBtnDate: { fontSize:12, color:T.muted },
    carryRow:    { flexDirection:"row", alignItems:"flex-start", gap:12, padding:13, borderWidth:1, borderColor:T.border, borderRadius:12, marginBottom:8, backgroundColor:T.bg },
    carryTitle:  { fontSize:14, color:T.text, fontWeight:"600" },
    carrySub:    { fontSize:12, color:T.muted, marginTop:3 },

    // ── Header ──────────────────────────────────────────────────────────────
    header:       { flexDirection:"row", alignItems:"center", backgroundColor:T.surface, paddingHorizontal:14,
                    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 32) + 10 : 10,
                    paddingBottom:10, borderBottomWidth:1, borderBottomColor:T.border },
    headerSub:    { fontSize:10, color:T.accentLight, textTransform:"uppercase", letterSpacing:2, marginBottom:2 },
    headerTitle:  { fontSize:18, color:T.text, fontWeight:"700" },
    iconBtn:      { borderWidth:1, borderColor:T.border, borderRadius:9, backgroundColor:T.bg, paddingHorizontal:9, paddingVertical:7 },
    dangerBtn:    { borderWidth:1, borderColor:T.danger+"44", borderRadius:9, backgroundColor:"#FFF5F5", paddingHorizontal:9, paddingVertical:7 },
    dangerBtnTxt: { fontSize:11, color:T.danger },

    // ── Week / Day tabs ──────────────────────────────────────────────────────
    weekRow:    { flexDirection:"row", gap:6, paddingHorizontal:10, paddingVertical:8, backgroundColor:T.surface, borderBottomWidth:1, borderBottomColor:T.border },
    weekTab:    { flex:1, alignItems:"center", padding:7, borderWidth:1, borderColor:T.border, borderRadius:10, backgroundColor:T.surface },
    weekTabTxt: { fontSize:11, color:T.muted },
    weekTabDate:{ fontSize:9,  color:T.muted, marginTop:1 },
    weekTabProg:{ fontSize:10, color:T.muted, marginTop:1 },
    dayTab:     { alignItems:"center", paddingVertical:7, paddingHorizontal:10, borderWidth:1, borderColor:T.border, borderRadius:12, backgroundColor:T.surface, minWidth:48 },
    dayTabTxt:  { fontSize:11, color:T.text },
    dayTabDate: { fontSize:9,  color:T.muted, marginTop:1 },
    dayTabProg: { fontSize:9,  color:T.muted, marginTop:1 },

    // ── Day header ───────────────────────────────────────────────────────────
    dayHeader:    { borderRadius:16, padding:14, marginBottom:0, borderWidth:1 },
    dayHeaderTag: { fontSize:11, fontWeight:"700", textTransform:"uppercase", letterSpacing:1, marginBottom:2 },
    dayHeaderName:{ fontSize:22, color:T.text, fontWeight:"700" },
    dayHeaderDate:{ fontSize:12, color:T.muted, marginTop:2 },
    dayHeaderPct: { fontSize:28, fontWeight:"800" },
    progressBg:   { height:5, backgroundColor:T.border, borderRadius:5, marginBottom:4 },
    progressFill: { height:5, borderRadius:5 },

    // ── Task cards ───────────────────────────────────────────────────────────
    // FIX: overflow:"hidden" retiré — c'était la cause du bug de repaint Android
    // qui faisait disparaitre le texte des cartes apres un changement d'etat rapide
    // (ex: toggle "important"). borderRadius fonctionne toujours sans overflow:hidden.
    card:         { backgroundColor:T.surface, borderWidth:1, borderColor:T.border, borderRadius:14, marginBottom:8 },
    cardDone:     { backgroundColor:"#F0FFF4", borderColor:"#86EFAC" },
    cardImportant:{ borderLeftWidth:4, borderLeftColor:T.important },
    cardRow:      { flexDirection:"row", alignItems:"center", gap:12, padding:13 },
    circle:       { width:24, height:24, borderRadius:12, borderWidth:2, alignItems:"center", justifyContent:"center", flexShrink:0 },
    cardLabel:    { fontSize:14, color:T.text, lineHeight:20 },
    cardLabelDone:{ color:T.muted, textDecorationLine:"line-through" },
    cardTime:     { fontSize:11, color:T.muted },
    cardMeta:     { fontSize:11, color:T.muted, marginTop:2 },
    mealPrev:     { fontSize:12, color:T.muted, marginTop:2, fontStyle:"italic" },
    // borderRadius ajouté ici en bas pour compenser la perte du clip automatique
    // qu'offrait overflow:"hidden" sur les coins inférieurs de la carte repas
    mealInput:    { borderTopWidth:1, borderTopColor:T.border, padding:10, fontSize:13, color:T.text, backgroundColor:T.bg, borderBottomLeftRadius:14, borderBottomRightRadius:14 },
    actBtn:       { borderWidth:1, borderColor:T.border, borderRadius:7, backgroundColor:T.bg, paddingHorizontal:9, paddingVertical:5 },
    actBtnRed:    { borderWidth:1, borderColor:T.danger+"33", borderRadius:7, backgroundColor:"#FFF5F5", paddingHorizontal:9, paddingVertical:5 },
    addBtn:       { borderWidth:1.5, borderStyle:"dashed", borderRadius:14, padding:15, alignItems:"center", marginTop:4, marginBottom:16 },
    addBtnTxt:    { fontSize:13 },

    // ── Done card ────────────────────────────────────────────────────────────
    doneCard: { backgroundColor:"#F0FFF4", borderWidth:1, borderColor:"#86EFAC", borderRadius:16, padding:20, alignItems:"center", marginBottom:16 },
    doneTxt:  { fontWeight:"700", color:"#2F9E6E", marginBottom:4, fontSize:16 },
    doneSub:  { fontSize:13, color:T.muted },

    // ── Profile picker ───────────────────────────────────────────────────────
    profileCard:       { flexDirection:"row", alignItems:"center", gap:12, padding:14, borderWidth:1, borderColor:T.border, borderRadius:14, marginBottom:8, backgroundColor:T.bg },
    profileCardActive: { borderColor:T.accent, borderWidth:2, backgroundColor:"#EBF3FC" },
    profileEmoji:      { fontSize:26 },
    profileLabel:      { fontSize:15, color:T.text, fontWeight:"600" },
    profileDesc:       { fontSize:12, color:T.muted, marginTop:3 },
  });
}

