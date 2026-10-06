const ADMIN_BACKEND_URL = "https://qr-usuario.onrender.com";
const SESSION_KEY = "avis_panel_session";
const STATS_RETRY_DELAY_MS = 4_000;
const STATS_MAX_ATTEMPTS = 2;

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function getToken() {
  return getSession()?.token || "";
}

function hideAllScreens() {
  ["admin-login-screen", "welcome-screen", "qr-screen", "stats-screen", "change-password-screen", "employee-qr-screen"]
    .forEach((id) => document.getElementById(id).classList.add("hidden"));
}

function showAdminArea() {
  hideAllScreens();
  document.getElementById("welcome-screen").classList.remove("hidden");
}

function showLoginScreen() {
  hideAllScreens();
  document.getElementById("admin-login-screen").classList.remove("hidden");
}

function showAdminHome() {
  showAdminArea();
}

function showChangePasswordScreen() {
  hideAllScreens();
  document.getElementById("change-password-screen").classList.remove("hidden");
}

function bindAdminLogin() {
  const form = document.getElementById("admin-login-form");
  const errorEl = document.getElementById("admin-login-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.classList.add("hidden");

    try {
      const response = await fetch(`${ADMIN_BACKEND_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("admin-username").value.trim(),
          password: document.getElementById("admin-password").value
        })
      });

      if (!response.ok) {
        throw new Error("Credenciales invalidas");
      }

      const { token, session } = await response.json();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, ...session }));

      if (session.role === "admin") {
        showAdminArea();
      } else if (session.mustChangePassword) {
        showChangePasswordScreen();
      } else {
        loadEmployeeQr();
      }
    } catch {
      errorEl.classList.remove("hidden");
    }
  });
}

function renderStatsTable(rows) {
  const wrap = document.getElementById("stats-table-wrap");
  wrap.replaceChildren();

  if (!rows.length) {
    wrap.textContent = "Aún no hay información disponible.";
    return;
  }

  const table = document.createElement("table");
  table.className = "stats-table";
  const headers = ["Nombre", "Ciudad", "Código", "Aperturas"];
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach((label) => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const values = [
      row.Nombre || "-",
      row.Ciudad || "-",
      row.Codigo || "-",
      row.Aperturas ?? row.TotalEscaneos ?? 0
    ];
    const tableRow = document.createElement("tr");
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.appendChild(cell);
    });
    tbody.appendChild(tableRow);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
}

async function loadStats(attempt = 1) {
  const wrap = document.getElementById("stats-table-wrap");
  wrap.textContent = attempt === 1 ? "Cargando..." : "Conectando con el servidor...";

  try {
    const month = document.getElementById("stats-month").value;
    const params = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await fetch(`${ADMIN_BACKEND_URL}/api/stats${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (response.status === 503 && attempt < STATS_MAX_ATTEMPTS) {
      setTimeout(() => loadStats(attempt + 1), STATS_RETRY_DELAY_MS);
      return;
    }

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `Error HTTP ${response.status}`);
    }

    renderStatsTable(await response.json());
  } catch (error) {
    const message = error instanceof TypeError
      ? "El servidor de estadísticas no está disponible. Pulsa Actualizar datos en unos segundos."
      : error.message;
    wrap.textContent = `No se pudo cargar la información: ${message}`;
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById("admin-login-form").reset();
  showLoginScreen();
}

function getEmployeeLandingUrl(qr) {
  const directory = window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/") + 1);
  const params = new URLSearchParams({
    codigo: qr.Codigo,
    nombre: `${qr.Nombre} ${qr.Apellido || ""}`.trim(),
    ciudad: qr.Ciudad
  });
  return `${window.location.origin}${directory}index.html?${params.toString()}`;
}

function renderEmployeeQr(qr) {
  const name = `${qr.Nombre} ${qr.Apellido || ""}`.trim();
  document.getElementById("employee-name").textContent = name;
  const card = document.getElementById("employee-qr-card");
  card.replaceChildren();

  const person = document.createElement("section");
  person.className = "person";
  const head = document.createElement("div");
  head.className = "person-head";
  const code = document.createElement("p");
  code.className = "person-code";
  code.textContent = qr.Codigo;
  head.append(code);

  const qrWrap = document.createElement("div");
  qrWrap.className = "qr-wrap";
  new QRCode(qrWrap, {
    text: getEmployeeLandingUrl(qr),
    width: 180,
    height: 180,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Descargar QR";
  download.addEventListener("click", () => {
    const image = qrWrap.querySelector("img")?.src || qrWrap.querySelector("canvas")?.toDataURL("image/png");
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `${qr.Codigo}.png`;
    link.click();
  });

  person.append(head, qrWrap, download);
  card.appendChild(person);
}

async function loadEmployeeQr() {
  hideAllScreens();
  document.getElementById("employee-qr-screen").classList.remove("hidden");
  try {
    const response = await fetch(`${ADMIN_BACKEND_URL}/api/mi-qr`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!response.ok) {
      throw new Error("No se pudo cargar tu QR");
    }
    renderEmployeeQr(await response.json());
  } catch {
    logout();
  }
}

function bindPasswordChange() {
  const form = document.getElementById("change-password-form");
  const error = document.getElementById("change-password-error");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.classList.add("hidden");
    const password = document.getElementById("new-password").value;
    if (password !== document.getElementById("confirm-password").value) {
      error.textContent = "Las contraseñas no coinciden";
      error.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(`${ADMIN_BACKEND_URL}/api/mi-clave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || "No se pudo actualizar la contraseña");
      }
      const currentSession = getSession();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...currentSession, mustChangePassword: false }));
      form.reset();
      loadEmployeeQr();
    } catch (exception) {
      error.textContent = exception.message;
      error.classList.remove("hidden");
    }
  });
}

function bindNavigation() {
  document.getElementById("users-btn").addEventListener("click", () => {
    hideAllScreens();
    document.getElementById("qr-screen").classList.remove("hidden");
  });

  document.getElementById("stats-btn").addEventListener("click", () => {
    hideAllScreens();
    document.getElementById("stats-screen").classList.remove("hidden");
    loadStats();
  });

  document.getElementById("back-to-admin-btn").addEventListener("click", showAdminHome);
  document.getElementById("back-to-admin-from-stats-btn").addEventListener("click", showAdminHome);
  document.getElementById("refresh-stats-btn").addEventListener("click", loadStats);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("employee-logout-btn").addEventListener("click", logout);
}

const session = getSession();
if (session?.role === "admin") {
  showAdminArea();
} else if (session?.role === "collaborator") {
  session.mustChangePassword ? showChangePasswordScreen() : loadEmployeeQr();
} else {
  showLoginScreen();
}
bindAdminLogin();
bindNavigation();
bindPasswordChange();