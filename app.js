import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
let session = null;
let currentSecret = "";

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).className = error ? "message error" : "message";
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function showDashboard() {
  $("loginPanel").hidden = true;
  $("dashboard").hidden = false;
  loadKeys();
}
function showLogin() {
  $("loginPanel").hidden = false;
  $("dashboard").hidden = true;
}
async function loadKeys() {
  try {
    const data = await api("/api/keys");
    const keys = data.keys || [];
    $("keyCount").textContent = keys.length;
    $("activeCount").textContent = keys.filter(k => k.status === "active").length;
    $("keyList").innerHTML = "";
    if (!keys.length) {
      $("keyList").innerHTML = '<p class="muted">Belum ada API Key. Buat key pertama.</p>';
      return;
    }
    for (const key of keys) {
      const row = document.createElement("div");
      row.className = "key-row";
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = key.label;
      const detail = document.createElement("small");
      detail.textContent = `${key.key_prefix}…  •  ${key.requests_count || 0} requests`;
      info.append(title, detail);
      const state = document.createElement("span");
      state.className = key.status === "active" ? "pill active" : "pill";
      state.textContent = key.status;
      const revoke = document.createElement("button");
      revoke.className = "ghost danger";
      revoke.textContent = "Revoke";
      revoke.disabled = key.status !== "active";
      revoke.addEventListener("click", () => revokeKey(key.id));
      row.append(info, state, revoke);
      $("keyList").append(row);
    }
  } catch (e) { message("dashboardMessage", e.message, true); }
}
async function revokeKey(id) {
  if (!confirm("Nonaktifkan API Key ini?")) return;
  try {
    await api("/api/keys", { method: "DELETE", body: JSON.stringify({ id }) });
    message("dashboardMessage", "API Key berhasil dinonaktifkan.");
    loadKeys();
  } catch (e) { message("dashboardMessage", e.message, true); }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("loginMessage", "Memeriksa akun...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) return message("loginMessage", error.message, true);
  session = data.session;
  const check = await fetch("/api/keys", { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (check.status === 403 || check.status === 401) {
    await supabase.auth.signOut();
    session = null;
    return message("loginMessage", "Akun ini tidak memiliki akses Owner.", true);
  }
  showDashboard();
});
$("createKeyBtn").addEventListener("click", async () => {
  const label = prompt("Nama API Key:", "My Application");
  if (label === null) return;
  try {
    const data = await api("/api/keys", { method: "POST", body: JSON.stringify({ label }) });
    currentSecret = data.secret;
    $("secretText").textContent = currentSecret;
    $("newSecret").hidden = false;
    message("dashboardMessage", "API Key dibuat. Salin sekarang karena hanya ditampilkan sekali.");
    loadKeys();
  } catch (e) { message("dashboardMessage", e.message, true); }
});
$("copySecret").addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentSecret);
  message("dashboardMessage", "API Key disalin.");
});
$("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  session = null;
  showLogin();
});
const { data: sessionData } = await supabase.auth.getSession();
if (sessionData.session) {
  session = sessionData.session;
  const check = await fetch("/api/keys", { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (check.ok) showDashboard();
  else showLogin();
} else showLogin();
