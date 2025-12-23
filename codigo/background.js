// Service Worker - Intermediario de mensajes
// Soporta múltiples tabs activos simultáneamente

let activeTabIds = new Set(); // Set de tabs activos
let isRunning = false;

// Escuchar mensajes desde popup y content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  
  // Si viene del content script iniciando observer
  if (message.action === "observarChats") {
    console.log("[Background] Observer iniciado en tabId:", tabId);
    activeTabIds.add(tabId);
    isRunning = true;
    saveState();
  } 
  
  // Si viene del popup - detener TODOS los observers activos
  if (message.action === "detenerChats") {
    console.log("[Background] Detener enviado a todos los tabs:", Array.from(activeTabIds));
    
    // Enviar a todos los tabs activos
    activeTabIds.forEach(id => {
      chrome.tabs.sendMessage(id, { action: "detenerChats" }).catch(() => {
        activeTabIds.delete(id);
      });
    });
    
    isRunning = false;
    saveState();
  }
  
  // Si viene del content script, retransmitir al popup si está abierto
  if (message.action === "popupEvent") {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});

// Limpiar si el tab se cierra
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabIds.has(tabId)) {
    console.log("[Background] Tab cerrado:", tabId);
    activeTabIds.delete(tabId);
    
    if (activeTabIds.size === 0) {
      isRunning = false;
    }
    saveState();
  }
});

// Guardar estado
function saveState() {
  chrome.storage.local.set({ 
    activeTabIds: Array.from(activeTabIds),
    isRunning 
  });
}

// Cargar estado al iniciar
chrome.storage.local.get(['activeTabIds', 'isRunning'], (result) => {
  activeTabIds = new Set(result.activeTabIds || []);
  isRunning = result.isRunning || false;
  console.log("[Background] Estado cargado:", { activeTabIds: Array.from(activeTabIds), isRunning });
});
