// Estado del popup - solo log de actividades
const popupState = {
  isRunning: false,
  logEntries: [],
  maxEntries: 100
};

// Cargar estado desde storage al abrir el popup
function loadStoredState() {
  chrome.storage.local.get(['popupState'], (result) => {
    if (result.popupState) {
      Object.assign(popupState, result.popupState);
      updateLogUI();
      updateButtonStates(popupState.isRunning);
    }
  });
}

// Guardar estado en storage
function saveState() {
  chrome.storage.local.set({ popupState: popupState });
}

// Agregar entrada al log
function addLog(message, type = 'info') {
  const now = new Date();
  const time = now.toLocaleTimeString('es-AR', { hour12: false });
  
  popupState.logEntries.unshift({
    time,
    message,
    type,
    timestamp: Date.now()
  });
  
  // Mantener solo las últimas maxEntries
  if (popupState.logEntries.length > popupState.maxEntries) {
    popupState.logEntries.pop();
  }
  
  updateLogUI();
  saveState();
}

// Actualizar UI del log
function updateLogUI() {
  const logContainer = document.getElementById('logContainer');
  
  if (popupState.logEntries.length === 0) {
    logContainer.innerHTML = '<div class="empty-log">Esperando actividad...</div>';
    return;
  }
  
  logContainer.innerHTML = popupState.logEntries.map(entry => `
    <div class="log-entry ${entry.type}">
      <span style="color: #64748b;">[${entry.time}]</span> ${entry.message}
    </div>
  `).join('');
  
  // Scroll al inicio
  logContainer.scrollTop = 0;
}

// Actualizar estado de botones
function updateButtonStates(running) {
  popupState.isRunning = running;
  document.getElementById('observarChatsBtn').disabled = running;
  document.getElementById('detenerChatsBtn').disabled = !running;
  saveState();
}

// Click en Iniciar
document.getElementById("observarChatsBtn").addEventListener("click", async () => {
  // Buscar TODAS las pestañas de Clientify abiertas
  const tabs = await chrome.tabs.query({ url: "https://new.clientify.com/team-inbox/*" });
  
  if (tabs.length === 0) {
    addLog('❌ No hay pestañas de Clientify abiertas', 'error');
    return;
  }
  
  // Enviar a TODAS las pestañas de Clientify
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: "observarChats" }).catch(() => {});
  });
  
  updateButtonStates(true);
  addLog(`🟢 Observador iniciado en ${tabs.length} pestaña(s)`, 'success');
});

// Click en Detener
document.getElementById("detenerChatsBtn").addEventListener("click", async () => {
  // Enviar al background worker, que retransmitirá al content script activo
  chrome.runtime.sendMessage({ action: "detenerChats" }).catch(() => {
    // Fallback: intentar con el tab actual
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "detenerChats" });
      }
    });
  });
  
  updateButtonStates(false);
  addLog('⏹️ Observador detenido', 'warning');
});

// Click en Limpiar
document.getElementById("limpiarHistorialBtn").addEventListener("click", () => {
  if (confirm('¿Limpiar el historial?')) {
    popupState.logEntries = [];
    updateLogUI();
    addLog('🗑️ Historial limpiado', 'info');
  }
});

// Escuchar mensajes desde el content script con actividades
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "popupEvent") {
    const { event, type = 'info', data } = message;
    
    switch(event) {
      case 'scrolling':
        addLog(`⬇️ Scrolleando chat...`, 'action');
        break;
      case 'tagearChat':
        addLog(`🏷️ Tageando chat en ${data.panel}`, 'action');
        break;
      case 'urlMapped':
        addLog(`✅ URL mapeada: ${data.url} → ${data.letra}`, 'success');
        break;
      case 'urlWaiting':
        addLog(`⏸️ URL esperando: ${data.url}`, 'warning');
        break;
      case 'observerStarted':
        addLog('🟢 Observer iniciado en Clientify', 'success');
        updateButtonStates(true);
        break;
      case 'observerStopped':
        addLog('⏹️ Observer detenido', 'warning');
        updateButtonStates(false);
        break;
      case 'error':
        addLog(`❌ Error: ${data.message}`, 'error');
        break;
      case 'panelDetected':
        addLog(`📍 Panel detectado: ${data.panel}`, 'info');
        break;
      case 'nomemclaturaGenerated':
        addLog(`📝 Nomenclatura: ${data.value}`, 'success');
        break;
      default:
        addLog(`${event}`, type);
    }
  }
});

// Cargar estado al abrir el popup
document.addEventListener('DOMContentLoaded', () => {
  loadStoredState();
  addLog('Panel cargado', 'info');
});
