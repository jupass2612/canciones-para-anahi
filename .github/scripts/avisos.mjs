// Envía los avisos de canciones nuevas. Lo ejecuta GitHub Actions (archivo .github/workflows/avisos.yml).
import fs from "node:fs";
import { execSync } from "node:child_process";
import webpush from "web-push";

const PUBLIC_KEY = "BLIGpo8At0jt1_JmS5X1_1XSQvChnuGtbr6Ni1WMBujPXl8-UcSpzCM5xjSwD6_VooN5NO_7-vedtvPdbF_q1Ds";
const { VAPID_PRIVATE_KEY, EVENT, APP_NAME = "", APP_URL } = process.env;
if (!VAPID_PRIVATE_KEY) { console.log("Falta el secreto VAPID_PRIVATE_KEY en Settings → Secrets and variables → Actions."); process.exit(0); }
webpush.setVapidDetails(APP_URL, PUBLIC_KEY, VAPID_PRIVATE_KEY);

const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const list = j => Array.isArray(j) ? j : ((j && j.songs) || []);
const sh = c => { try { return execSync(c, { encoding: "utf8" }); } catch { return ""; } };
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const subs = read("push/subs.json", { subs: [] }).subs || [];
if (!subs.length) { console.log("Todavía no hay teléfonos registrados."); process.exit(0); }

const changed = sh("git diff --name-only HEAD~1 HEAD");
const songs = list(read("songs/songs.json", []));
const visible = songs.filter(s => s.id !== "0000-muestra" && (!s.date || s.date <= today));
let payload = null, newSent = null;

if (EVENT === "workflow_dispatch" || (EVENT === "push" && changed.includes("push/test.json") && !changed.includes("songs/songs.json"))) {
  payload = { title: `Canciones para ${APP_NAME} ❤`, body: "Los avisos ya funcionan. Aquí te llegarán las canciones nuevas.", url: APP_URL, tag: "prueba" };
} else {
  let sent = read("push/sent.json", null);
  if (!sent) {
    // Primera vez: las canciones que ya existían no se avisan.
    const prev = new Set(list((() => { try { return JSON.parse(sh("git show HEAD~1:songs/songs.json")); } catch { return []; } })()).map(s => s.id));
    sent = visible.filter(s => EVENT !== "push" || prev.has(s.id)).map(s => s.id);
  }
  const done = new Set(sent);
  const fresh = visible.filter(s => !done.has(s.id));
  fresh.forEach(s => done.add(s.id));
  newSent = [...done];
  if (fresh.length === 1) {
    const s = fresh[0];
    payload = { title: "Tienes una canción nueva ❤", body: s.title + (s.artist ? " · " + s.artist : "") + (s.dedication ? "\n" + s.dedication : ""), url: APP_URL + "#hoy", tag: s.id };
  } else if (fresh.length > 1) {
    payload = { title: `Tienes ${fresh.length} canciones nuevas ❤`, body: fresh.map(s => s.title).join(" · "), url: APP_URL + "#dedicatorias", tag: "nuevas" };
  }
}

if (payload) {
  for (const sub of subs) {
    try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 24 * 3 }); console.log("Aviso enviado."); }
    catch (e) { console.log(e.statusCode === 404 || e.statusCode === 410 ? "Un teléfono ya no está registrado (se reinstaló la app)." : "No se pudo enviar: " + (e.statusCode || e.message)); }
  }
} else console.log("No hay canciones nuevas que avisar.");

if (newSent) {
  fs.mkdirSync("push", { recursive: true });
  fs.writeFileSync("push/sent.json", JSON.stringify(newSent, null, 2) + "\n");
  sh('git config user.name "github-actions[bot]" && git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
  sh('git add push/sent.json && (git diff --cached --quiet || (git commit -m "Avisos enviados" && git pull --rebase && git push))');
}
