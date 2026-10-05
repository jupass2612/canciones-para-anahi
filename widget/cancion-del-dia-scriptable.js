// Widget "Canción de hoy" para el iPhone de Anahí, con la app gratuita Scriptable.
// 1. Cambia BASE por la dirección donde está publicada la app (termina en /).
// 2. En Scriptable: + → pega este script → nómbralo "Canción de hoy".
// 3. En la pantalla de inicio: mantener presionado → + → Scriptable → elige tamaño
//    → toca el widget → Script: "Canción de hoy". Tocarlo abre la app.

const BASE = "https://TU-USUARIO.github.io/canciones-para-anahi/";

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayNum = s => { const [y, m, d] = s.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
function firstLine(lrc) {
  for (const raw of String(lrc || "").split(/\r?\n/)) {
    const t = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (t && t !== "♪") return t;
  }
  return "";
}

// Misma regla que la app: la dedicada para hoy; si no hay, una anterior en rotación.
async function songOfDay() {
  const req = new Request(BASE + "songs/songs.json?t=" + Date.now());
  const json = await req.loadJSON();
  const t = ymd(new Date());
  const vis = (Array.isArray(json) ? json : json.songs || [])
    .filter(s => !s.date || s.date <= t)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!vis.length) return null;
  const fresh = vis.filter(s => s.date === t);
  if (fresh.length) return { song: fresh[fresh.length - 1], fresh: true };
  return { song: vis[dayNum(t) % vis.length], fresh: false };
}

const w = new ListWidget();
w.url = BASE + "#hoy";
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000); // revisa cada ~30 min (iOS decide el momento exacto)

let pick = null;
try { pick = await songOfDay(); } catch (e) {}
const song = pick && pick.song;
const big = config.widgetFamily !== "small";

const g = new LinearGradient();
g.colors = [new Color(song?.color || "#8e2453"), new Color("#1a0710")];
g.locations = [0, 1];
w.backgroundGradient = g;
w.setPadding(14, 16, 14, 16);

const label = w.addText(pick?.fresh ? "NUEVA PARA TI ♥" : "CANCIÓN DE HOY ♥");
label.font = Font.semiboldSystemFont(10);
label.textColor = new Color("#ffffff", 0.85);
w.addSpacer(6);

if (song) {
  const t = w.addText(song.title);
  t.font = new Font("Georgia-Italic", big ? 24 : 20);
  t.textColor = Color.white();
  t.minimumScaleFactor = 0.6;
  t.lineLimit = 2;
  if (song.artist) {
    const a = w.addText(song.artist);
    a.font = Font.systemFont(12);
    a.textColor = new Color("#ffffff", 0.75);
  }
  w.addSpacer();
  const extra = song.dedication || firstLine(song.lyrics);
  if (extra) {
    const d = w.addText(extra);
    d.font = new Font("Georgia-Italic", big ? 14 : 12);
    d.textColor = new Color("#ffffff", 0.92);
    d.lineLimit = big ? 3 : 2;
  }
} else {
  w.addSpacer();
  const t = w.addText("Muy pronto llegará tu primera canción");
  t.font = new Font("Georgia-Italic", 15);
  t.textColor = Color.white();
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
