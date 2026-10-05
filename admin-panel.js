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
  showAdminArea();
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

      const { token } = await response.json();
      sessionStorage.setItem(TOKEN_KEY, token);
      showAdminArea();
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
  const headers = ["Fecha", "Nombre", "Ciudad", "Código", "Aperturas"];
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
      row.Dia || row.Fecha || "-",
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

async function loadStats() {
  const wrap = document.getElementById("stats-table-wrap");
  wrap.textContent = "Cargando...";

  try {
    const response = await fetch(`${ADMIN_BACKEND_URL}/api/stats`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `Error HTTP ${response.status}`);
    }

    renderStatsTable(await response.json());
  } catch (error) {
    wrap.textContent = `No se pudo cargar la información: ${error.message}`;
  }
}

function bindNavigation() {
  document.getElementById("users-btn").addEventListener("click", () => {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("qr-screen").classList.remove("hidden");
    document.getElementById("stats-screen").classList.add("hidden");
  });

  document.getElementById("stats-btn").addEventListener("click", () => {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("qr-screen").classList.add("hidden");
    document.getElementById("stats-screen").classList.remove("hidden");
    loadStats();
  });

  document.getElementById("back-to-admin-btn").addEventListener("click", showAdminHome);
  document.getElementById("back-to-admin-from-stats-btn").addEventListener("click", showAdminHome);
  document.getElementById("refresh-stats-btn").addEventListener("click", loadStats);
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
bindNavigation();