// Reemplaza con la URL real del backend una vez desplegado (ver server/README.md).
const ADMIN_BACKEND_URL = "https://TU-BACKEND.onrender.com";
const TOKEN_KEY = "avis_admin_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function showAdminArea() {
  document.getElementById("admin-login-screen").classList.add("hidden");
  document.getElementById("welcome-screen").classList.remove("hidden");
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
function renderStatsTable(wrap, rows) {
  wrap.replaceChildren();

  if (!rows.length) {
    wrap.textContent = "Aún no hay aperturas registradas.";
    return;
  }

  const table = document.createElement("table");
  table.className = "stats-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Fecha", "Nombre", "Ciudad", "Código", "Aperturas"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [row.Dia, row.Nombre, row.Ciudad, row.Codigo, row.Aperturas].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
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
      throw new Error("No autorizado");
    }

    renderStatsTable(wrap, await response.json());
  } catch {
    wrap.textContent = "No se pudo cargar la información. Inicia sesión nuevamente.";
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

if (getToken()) {
  showAdminArea();
} else {
  bindAdminLogin();
}
bindStatsButton();
