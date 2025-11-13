const STORAGE_KEY = "geoRemindersApp";

let reminders = [];
let lastSelectedLocation = null;
let userMarker = null;
let geoWatchId = null;
let map = null;
let locationMarker = null;
let locationCircle = null;
let reminderLayers = [];

function loadReminders() {
  const raw = localStorage.getItem(STORAGE_KEY);
  reminders = raw ? JSON.parse(raw) : [];
}

function saveReminders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function renderReminders() {
  const listEl = document.getElementById("remindersList");
  listEl.innerHTML = "";

  if (!reminders.length) {
    listEl.innerHTML = "<p>No hay recordatorios guardados.</p>";
    return;
  }

  reminders.forEach((reminder) => {
    const item = document.createElement("div");
    item.className = "reminder-item";

    const header = document.createElement("div");
    header.className = "reminder-header";

    const title = document.createElement("span");
    title.className = "reminder-title";
    title.textContent = reminder.title;

    const badge = document.createElement("span");
    badge.className = "badge " + (reminder.triggered ? "badge-triggered" : "badge-pending");
    badge.textContent = reminder.triggered ? "Disparado" : "Pendiente";

    header.appendChild(title);
    header.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "reminder-meta";
    meta.textContent = `Radio: ${reminder.radius} m | Lat: ${reminder.lat.toFixed(
      5
    )}, Lng: ${reminder.lng.toFixed(5)}`;

    const actions = document.createElement("div");
    actions.className = "reminder-actions";

    const btnDelete = document.createElement("button");
    btnDelete.className = "secondary-btn";
    btnDelete.textContent = "Eliminar";
    btnDelete.addEventListener("click", () => {
      deleteReminder(reminder.id);
    });

    const btnReset = document.createElement("button");
    btnReset.className = "secondary-btn";
    btnReset.textContent = "Reiniciar estado";
    btnReset.addEventListener("click", () => {
      resetReminder(reminder.id);
    });

    actions.appendChild(btnDelete);
    actions.appendChild(btnReset);

    item.appendChild(header);
    item.appendChild(meta);
    item.appendChild(actions);

    listEl.appendChild(item);
  });
}

function deleteReminder(id) {
  reminders = reminders.filter((r) => r.id !== id);
  saveReminders();
  renderReminders();
  syncRemindersOnMap();
}

function resetReminder(id) {
  reminders = reminders.map((r) =>
    r.id === id ? { ...r, triggered: false } : r
  );
  saveReminders();
  renderReminders();
}

// Notificaciones

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  const closeBtn = document.createElement("span");
  closeBtn.className = "toast-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    container.removeChild(toast);
  });

  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
  }, 4000);
}

//Distancia

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Radio Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

//Mapa

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

 
  map = L.map("map").setView([14.6349, -90.5069], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    setLocationFromMap(lat, lng);
  });

  syncRemindersOnMap();
}

function setLocationFromMap(lat, lng) {
  lastSelectedLocation = { lat, lng };
  setLocationStatus(`Ubicación seleccionada: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

  const radiusInput = document.getElementById("radius");
  const radius = parseInt(radiusInput.value, 10) || 100;

  
  if (locationMarker) {
    map.removeLayer(locationMarker);
  }
  if (locationCircle) {
    map.removeLayer(locationCircle);
  }

 
  locationMarker = L.marker([lat, lng]).addTo(map);

  
  locationCircle = L.circle([lat, lng], {
    radius,
    color: "#22c55e",
    fillColor: "#22c55e",
    fillOpacity: 0.15,
  }).addTo(map);
}

function updateRadiusOnMap() {
  if (!locationCircle || !lastSelectedLocation) return;

  const radiusInput = document.getElementById("radius");
  const radius = parseInt(radiusInput.value, 10) || 150;
    if (radius < 50) radius = 50;

  locationCircle.setRadius(radius);
}


function syncRemindersOnMap() {
  if (!map) return;


  reminderLayers.forEach((layer) => {
    map.removeLayer(layer);
  });
  reminderLayers = [];

 
  reminders.forEach((reminder) => {
    const marker = L.circleMarker([reminder.lat, reminder.lng], {
      radius: 6,
      color: reminder.triggered ? "#22c55e" : "#fbbf24",
      fillColor: reminder.triggered ? "#22c55e" : "#fbbf24",
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(
      `<strong>${reminder.title}</strong><br>Radio: ${reminder.radius} m`
    );

    reminderLayers.push(marker);
  });
}

function updateUserPositionOnMap(lat, lng) {
  if (!map) return;

  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], {
      radius: 6,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.9,
    }).addTo(map);
    userMarker.bindPopup("Tu ubicación actual");
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

function setLocationStatus(text) {
  const statusEl = document.getElementById("locationStatus");
  statusEl.textContent = text;
}

function handleGeoError(err, context = "geo") {
  console.error(`Error geolocalización (${context}):`, err);

  if (err.code === 1) {
    
    setLocationStatus("Permiso de ubicación denegado.");
    showToast("Debe permitir el acceso a la ubicación en el navegador.", "warning");
  } else if (err.code === 2) {
    
    setLocationStatus("Posición no disponible.");
    showToast("No se pudo obtener la ubicación (sin señal o servicio desactivado).", "warning");
  } else if (err.code === 3) {

    setLocationStatus("La solicitud de ubicación expiró.");
    showToast(
      "La ubicación tardó demasiado en responder. Intente de nuevo, active GPS o use el mapa manualmente.",
      "warning"
    );
  } else {
    setLocationStatus("Error desconocido de ubicación.");
    showToast("Error desconocido de ubicación.", "warning");
  }
}

function captureCurrentLocation() {
  if (!navigator.geolocation) {
    setLocationStatus("Geolocalización no soportada por este navegador.");
    showToast("Geolocalización no soportada.", "warning");
    return;
  }

  setLocationStatus("Obteniendo ubicación…");
  showToast("Obteniendo su ubicación actual…", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      if (map) {
        map.setView([latitude, longitude], 16);
      }

      updateUserPositionOnMap(latitude, longitude);
      setLocationFromMap(latitude, longitude);

      showToast("Ubicación actual establecida en el mapa.", "success");
    },
    (err) => {
      handleGeoError(err, "getCurrentPosition");
      setLocationStatus("Error al obtener ubicación.");
      showToast("Error al obtener la ubicación.", "warning");
    },
    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 1000,
    }
  );
}

function startWatcher() {
  if (!navigator.geolocation) return;

  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      updateUserPositionOnMap(latitude, longitude);
      checkReminders(latitude, longitude);
    },
    (err) => {
      handleGeoError(err, "watchPosition");
    },
    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 2000,
    }
  );
}

function checkReminders(currentLat, currentLng) {
  let updated = false;

  reminders.forEach((reminder) => {
    if (reminder.triggered) return;

    const d = distanceMeters(currentLat, currentLng, reminder.lat, reminder.lng);

    if (d <= reminder.radius) {
      reminder.triggered = true;
      updated = true;
      showToast(
        `Recordatorio cercano: ${reminder.title} (≈ ${d.toFixed(1)} m)`,
        "success"
      );
    }
  });

  if (updated) {
    saveReminders();
    renderReminders();
    syncRemindersOnMap();
  }
}

function handleSaveReminder() {
  const titleInput = document.getElementById("title");
  const radiusInput = document.getElementById("radius");

  const title = titleInput.value.trim();
  const radius = parseInt(radiusInput.value, 10);

  if (!title) {
    showToast("Ingrese un título para el recordatorio.", "warning");
    return;
  }

  if (!lastSelectedLocation) {
    showToast("Seleccione una ubicación en el mapa o use su ubicación actual.", "warning");
    return;
  }

  if (isNaN(radius) || radius <= 0) {
    showToast("Ingrese un radio válido en metros.", "warning");
    return;
  }

  const newReminder = {
    id: Date.now(),
    title,
    radius,
    lat: lastSelectedLocation.lat,
    lng: lastSelectedLocation.lng,
    triggered: false,
  };

  reminders.push(newReminder);
  saveReminders();
  renderReminders();
  syncRemindersOnMap();

  titleInput.value = "";
  showToast("Recordatorio guardado correctamente.", "success");
}


document.addEventListener("DOMContentLoaded", () => {
  loadReminders();
  renderReminders();
  initMap();

  const btnUseLocation = document.getElementById("btnUseLocation");
  const btnSave = document.getElementById("btnSaveReminder");
  const radiusInput = document.getElementById("radius");

  btnUseLocation.addEventListener("click", captureCurrentLocation);
  btnSave.addEventListener("click", handleSaveReminder);
  radiusInput.addEventListener("input", updateRadiusOnMap);

  captureCurrentLocation();
  startWatcher();
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("Service Worker registrado:", reg.scope);
      })
      .catch((err) => {
        console.error("Error al registrar el Service Worker:", err);
      });
  });
}