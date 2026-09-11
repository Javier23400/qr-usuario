const teamByCity = {
  QUITO: [
    "DANIEL PALACIOS",
    "WILLIAM VIRACOCHA",
    "LUIS CACUANGO",
    "ALEXANDER RAMIREZ",
    "SANDRA MOROCHO",
    "ANDRES PASQUEL"
  ],
  GUAYAQUI: [
    "LUIS GANCHOZO",
    "CARLA BOZADA",
    "MARIELA SILVA"
  ],
  MANTA: [
    "RENE CARREÑO",
    "VICTOR DEMERA"
  ],
  CUENCA: [
    "SERGIO MOROCHO"
  ]
};

const reviewUrlByCity = {
  QUITO: "https://search.google.com/local/writereview?placeid=ChIJt0NbCHSQ1ZERR-637wqodcE",
  GUAYAQUI: "https://search.google.com/local/writereview?placeid=ChIJMxmMTw9tLZARRR8xAazdjEQ",
  MANTA: "https://search.google.com/local/writereview?placeid=ChIJr7NqWgDnK5ARW9p6if_5CQk",
  CUENCA: "https://search.google.com/local/writereview?placeid=ChIJeapt9SQYzZER-Y01p6dazp8"
};

const BACKEND_URL = "https://qr-usuario.onrender.com";

// Registra la apertura del QR en la base de datos. Nunca bloquea la experiencia del usuario si falla.
function trackOpen(scanContext) {
  fetch(`${BACKEND_URL}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scanContext)
  }).catch(() => {});
}


// Appends tracking params before any #fragment so the link stays valid.
function appendParams(url, params) {
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}${hash}`;
}

const FEATURED_QR_URL = "https://www.google.com/search?q=budget+ecuador#lrd=0x91d59074085b43b7:0xc175a80aefb7ee47,3,,,,";

function normalizeCode(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function resolveReviewUrl(city, params) {
  return appendParams(reviewUrlByCity[city], params);
}

// Los QR siempre apuntan a index.html (la página de escaneo), aunque se generen desde admin.html.
function getLandingBaseUrl() {
  const path = window.location.pathname;
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  return `${window.location.origin}${dir}index.html`;
}

function createPayload(name, city, index) {
  const personCode = `${normalizeCode(city).slice(0, 4)}-${String(index + 1).padStart(3, "0")}`;
  const params = new URLSearchParams({
    codigo: personCode,
    nombre: name,
    ciudad: city
  });
  const landingUrl = `${getLandingBaseUrl()}?${params.toString()}`;

  return {
    personCode,
    qrValue: landingUrl
  };
}

function getQrImageUrl(wrapper) {
  const img = wrapper.querySelector("img");
  if (img && img.src) {
    return img.src;
  }

  const canvas = wrapper.querySelector("canvas");
  if (canvas) {
    return canvas.toDataURL("image/png");
  }

  return "";
}

function buildPage() {
  const root = document.getElementById("cities-container");

  Object.entries(teamByCity).forEach(([city, users], cityIndex) => {
    const citySection = document.createElement("article");
    citySection.className = "city";
    citySection.style.animationDelay = `${cityIndex * 0.08}s`;

    const cityTitle = document.createElement("h2");
    cityTitle.textContent = city;

    const peopleGrid = document.createElement("div");
    peopleGrid.className = "people";

    users.forEach((name, index) => {
      const { personCode, qrValue } = createPayload(name, city, index);

      const card = document.createElement("section");
      card.className = "person";

      const head = document.createElement("div");
      head.className = "person-head";

      const nameEl = document.createElement("h3");
      nameEl.className = "person-name";
      nameEl.textContent = name;

      const codeEl = document.createElement("p");
      codeEl.className = "person-code";
      codeEl.textContent = personCode;

      head.append(nameEl, codeEl);

      const qrWrap = document.createElement("div");
      qrWrap.className = "qr-wrap";

      new QRCode(qrWrap, {
        text: qrValue,
        width: 126,
        height: 126,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });

      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.textContent = "Descargar QR";

      downloadBtn.addEventListener("click", () => {
        const dataUrl = getQrImageUrl(qrWrap);
        if (!dataUrl) return;

        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${personCode}-${normalizeCode(name)}.png`;
        link.click();
      });

      card.append(head, qrWrap, downloadBtn);
      peopleGrid.appendChild(card);
    });

    citySection.append(cityTitle, peopleGrid);
    root.appendChild(citySection);
  });
}

function buildFeaturedQr() {
  const qrWrap = document.getElementById("featured-qr-wrap");
  const downloadBtn = document.getElementById("download-featured-qr-btn");
  const copyBtn = document.getElementById("copy-featured-link-btn");

  if (!qrWrap || !downloadBtn || !copyBtn) {
    return;
  }

  new QRCode(qrWrap, {
    text: FEATURED_QR_URL,
    width: 160,
    height: 160,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  downloadBtn.addEventListener("click", () => {
    const dataUrl = getQrImageUrl(qrWrap);
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "BUDGET-ECUADOR-QR.png";
    link.click();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(FEATURED_QR_URL);
      copyBtn.textContent = "Enlace copiado";
      setTimeout(() => {
        copyBtn.textContent = "Copiar enlace";
      }, 1400);
    } catch {
      copyBtn.textContent = "No se pudo copiar";
      setTimeout(() => {
        copyBtn.textContent = "Copiar enlace";
      }, 1400);
    }
  });
}

function bindWelcomeFlow() {
  const acceptBtn = document.getElementById("accept-btn");

  acceptBtn.addEventListener("click", () => {
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("qr-screen").classList.remove("hidden");
  });
}

// Cuando el enlace del QR se abre en el teléfono, muestra la pantalla de bienvenida con el botón "Abrir".
function getScanContext() {
  const params = new URLSearchParams(window.location.search);
  const ciudad = (params.get("ciudad") || "").toUpperCase();
  if (!reviewUrlByCity[ciudad]) {
    return null;
  }

  return {
    ciudad,
    nombre: params.get("nombre") || "",
    codigo: params.get("codigo") || ""
  };
}

function showLandingScreen(scanContext) {
  trackOpen(scanContext);

  document.getElementById("welcome-screen")?.classList.add("hidden");
  document.getElementById("qr-screen")?.classList.add("hidden");

  const landingScreen = document.getElementById("landing-screen");
  const greeting = document.getElementById("landing-greeting");
  const openBtn = document.getElementById("landing-open-btn");

  greeting.textContent = scanContext.nombre ? `¡Hola, te saluda ${scanContext.nombre}!` : "¡Hola!";
  landingScreen.classList.remove("hidden");

  openBtn.addEventListener("click", () => {
    const params = new URLSearchParams({
      codigo: scanContext.codigo,
      nombre: scanContext.nombre,
      ciudad: scanContext.ciudad
    });
    window.location.href = resolveReviewUrl(scanContext.ciudad, params);
  });
}

// Muestra un aviso cuando index.html se abre sin un enlace de usuario válido.
function showInvalidLinkScreen() {
  const invalidScreen = document.getElementById("invalid-link-screen");
  if (invalidScreen) {
    invalidScreen.classList.remove("hidden");
  }
}

const scanContext = getScanContext();
if (scanContext) {
  showLandingScreen(scanContext);
} else if (document.getElementById("welcome-screen")) {
  buildPage();
  bindWelcomeFlow();
  buildFeaturedQr();
} else {
  showInvalidLinkScreen();
}
