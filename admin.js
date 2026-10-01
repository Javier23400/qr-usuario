const ADMIN_BACKEND_URL = "https://qr-usuario.onrender.com";
const TOKEN_KEY = "avis_admin_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function showAdminArea() {
  document.getElementById("admin-login-screen").classList.add("hidden");
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("qr-screen").classList.add("hidden");
  document.getElementById("stats-screen").classList.add("hidden");
}

function showLoginScreen() {
  document.getElementById("admin-login-screen").classList.remove("hidden");
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("qr-screen").classList.add("hidden");
  document.getElementById("stats-screen").classList.add("hidden");
}

function showAdminHome() {
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("qr-screen").classList.add("hidden");
  document.getElementById("stats-screen").classList.add("hidden");
  document.getElementById("admin-login-screen").classList.add("hidden");
}

function bindAdminLogin() {
  const form = document.getElementById("admin-login-form");
  const errorEl = document.getElementById("admin-login-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.classList.add("hidden");

    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    try {
      const response = await fetch(`${ADMIN_BACKEND_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error("Credenciales invalidas");
      }

      const { token } = await response.json();
      sessionStorage.setItem(TOKEN_KEY, token);
      showAdminArea();
    } catch {
      errorEl.classList.remove("hidden");
    }
  });
}

// Construye la tabla con DOM y textContent (nunca innerHTML) para evitar inyectar HTML no confiable.
function renderGenericTable(wrap, headers, rows) {
  wrap.replaceChildren();

  if (!rows.length) {
    wrap.textContent = "Aún no hay información disponible.";
    return;
  }

  const table = document.createElement("table");
  table.className = "stats-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  rows.forEach((values) => {
    const tr = document.createElement("tr");
    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value ?? "-";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
}

function renderStatsTable(wrap, rows) {
  const normalizedRows = rows.map((row) => [
    row.Dia || row.Fecha || "-",
    row.Nombre || "-",
    row.Ciudad || "-",
    row.Codigo || "-",
    row.Aperturas ?? row.TotalEscaneos ?? 0
  ]);

  renderGenericTable(wrap, ["Fecha", "Nombre", "Ciudad", "Código", "Aperturas"], normalizedRows);
}

function renderUsersTable(wrap, rows) {
  const normalizedRows = rows.map((row) => [
    row.Nombre || "-",
    row.Apellido || "-",
    row.Ciudad || "-",
    row.Rol || "-",
    row.Codigo || "-",
    row.TotalEscaneos ?? row.Aperturas ?? 0
  ]);

  renderGenericTable(wrap, ["Nombre", "Apellido", "Ciudad", "Rol", "QR", "Escaneos"], normalizedRows);
}

async function loadStats() {
  const wrap = document.getElementById("stats-table-wrap");
  wrap.textContent = "Cargando...";

  try {
    const response = await fetch(`${ADMIN_BACKEND_URL}/api/stats`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const message = detail.error || `Error HTTP ${response.status}`;
      throw new Error(detail.code ? `${message} (${detail.code})` : message);
    }

    const rows = await response.json();
    renderStatsTable(wrap, rows);
  } catch (error) {
    wrap.textContent = `No se pudo cargar la información: ${error.message}`;
  }
}

async function loadUsers() {
  const wrap = document.getElementById("stats-table-wrap");
  wrap.textContent = "Cargando...";

  try {
    const response = await fetch(`${ADMIN_BACKEND_URL}/api/admin/usuarios`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const message = detail.error || `Error HTTP ${response.status}`;
      throw new Error(detail.code ? `${message} (${detail.code})` : message);
    }

    const rows = await response.json();
    renderUsersTable(wrap, rows);
  } catch (error) {
    wrap.textContent = `No se pudo cargar la lista de usuarios: ${error.message}`;
  }
}

function bindStatsButton() {
  document.getElementById("stats-btn").addEventListener("click", () => {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("qr-screen").classList.add("hidden");
    document.getElementById("stats-screen").classList.remove("hidden");
    loadStats();
  });
}

function bindUsersButton() {
  document.getElementById("users-btn").addEventListener("click", () => {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("qr-screen").classList.add("hidden");
    document.getElementById("stats-screen").classList.remove("hidden");
    loadUsers();
  });
}

function bindNavigation() {
  document.getElementById("back-to-admin-btn").addEventListener("click", showAdminHome);
  document.getElementById("back-to-admin-from-stats-btn").addEventListener("click", showAdminHome);
  document.getElementById("refresh-stats-btn").addEventListener("click", () => {
    const statsVisible = !document.getElementById("stats-screen").classList.contains("hidden");
    if (statsVisible) {
      loadStats();
    }
  });
  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    document.getElementById("admin-login-form").reset();
    showLoginScreen();
  });
}

if (getToken()) {
  showAdminArea();
} else {
  showLoginScreen();
  bindAdminLogin();
}
bindUsersButton();
bindStatsButton();
bindNavigation();
