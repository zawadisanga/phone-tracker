// Main application logic
const socket = io();

// DOM Elements
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const scanStatus = document.getElementById('scanStatus');
const statusText = document.getElementById('statusText');
const distanceInfo = document.getElementById('distanceInfo');
const detectedDevicesDiv = document.getElementById('detectedDevices');
const femaleDevicesDiv = document.getElementById('femaleDevices');
const showDbBtn = document.getElementById('showDbBtn');
const deviceDatabaseDiv = document.getElementById('deviceDatabase');
const deviceListDiv = document.getElementById('deviceList');
const addDeviceBtn = document.getElementById('addDeviceBtn');
const sendSmsBtn = document.getElementById('sendSmsBtn');
const makeCallBtn = document.getElementById('makeCallBtn');
const commsResult = document.getElementById('commsResult');

// State
let scanner = null;
let detectedDevices = [];
let femaleDevices = [];
let currentDistance = null;
let isScanning = false;

// Initialize scanner
function initScanner() {
    scanner = new BluetoothProximityScanner();
    
    scanner.onDeviceFound = (device) => {
        console.log('Device found within 10m:', device);
        
        // Emit to server
        socket.emit('device-detected', {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            distance: device.distance,
            rssi: device.rssi
        });
    };
    
    scanner.onDistanceUpdate = (update) => {
        currentDistance = update.distance;
        updateDistanceDisplay(update);
    };
    
    scanner.onError = (error) => {
        showToast(error, 'error');
        stopScanning();
    };
}

// Update distance display
function updateDistanceDisplay(update) {
    const distanceMeters = update.distance;
    const isWithin10m = distanceMeters <= 10;
    
    distanceInfo.innerHTML = `
        <strong>📊 Current Device:</strong> ${update.deviceName}<br>
        <strong>📡 Signal (RSSI):</strong> ${update.rssi} dBm<br>
        <strong>📏 Distance:</strong> <span style="color: ${isWithin10m ? '#28a745' : '#dc3545'}; font-weight: bold;">${distanceMeters.toFixed(1)} meters</span><br>
        <strong>⏱️ Time:</strong> ${new Date(update.timestamp).toLocaleTimeString()}
        ${isWithin10m ? '<br>✅ <strong>NDANI YA MITA 10!</strong>' : '<br>⚠️ Nje ya mita 10'}
    `;
}

// Start scanning
async function startScanning() {
    if (isScanning) {
        showToast('Utafutaji tayari unaendelea', 'warning');
        return;
    }
    
    statusText.textContent = 'Inatafuta...';
    scanStatus.className = 'indicator scanning';
    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    
    const success = await scanner.startScanning();
    
    if (success) {
        isScanning = true;
        statusText.textContent = 'Inatafuta vifaa...';
        showToast('Utafutaji umeanza!', 'success');
    } else {
        stopScanning();
        showToast('Haiwezi kuanza utafutaji. Angalia Bluetooth na ruhusa.', 'error');
    }
}

// Stop scanning
function stopScanning() {
    if (scanner) {
        scanner.stopScanning();
    }
    
    isScanning = false;
    statusText.textContent = 'Utafutaji umesimamishwa';
    scanStatus.className = 'indicator stopped';
    startScanBtn.disabled = false;
    stopScanBtn.disabled = true;
}

// Update detected devices display
function updateDetectedDevices(device) {
    // Add to detected devices if not exists
    const exists = detectedDevices.find(d => d.deviceId === device.deviceId);
    if (!exists) {
        detectedDevices.unshift(device);
        if (detectedDevices.length > 20) detectedDevices.pop();
    } else {
        exists.lastSeen = device.timestamp;
        exists.distance = device.distance;
    }
    
    // Render
    if (detectedDevices.length === 0) {
        detectedDevicesDiv.innerHTML = '<div class="empty-state"><span class="icon">📱</span><p>Hakuna vifaa bado. Anza utafutaji...</p></div>';
        return;
    }
    
    detectedDevicesDiv.innerHTML = detectedDevices.map(device => `
        <div class="device-card ${device.gender === 'female' ? 'female' : ''}">
            <h3>${device.deviceName || 'Unknown Device'}</h3>
            <p><strong>ID:</strong> ${device.deviceId}</p>
            <p><strong>📏 Distance:</strong> <span class="distance">${device.distance?.toFixed(1) || '?'} meters</span></p>
            ${device.phoneNumber ? `<p><strong>📞 Phone:</strong> <span class="phone">${device.phoneNumber}</span></p>` : ''}
            ${device.ownerName ? `<p><strong>👤 Owner:</strong> ${device.ownerName}</p>` : ''}
            ${device.gender ? `<p><strong>🚻 Gender:</strong> ${device.gender === 'female' ? '👩 Mwanamke' : '👨 Mwanaume'}</p>` : ''}
            <p><strong>⏱️ Time:</strong> ${new Date(device.timestamp).toLocaleTimeString()}</p>
        </div>
    `).join('');
}

// Update female devices display
function updateFemaleDevices(device) {
    if (device.gender !== 'female') return;
    
    // Add if not exists
    const exists = femaleDevices.find(d => d.deviceId === device.deviceId);
    if (!exists) {
        femaleDevices.unshift(device);
    } else {
        exists.lastSeen = device.timestamp;
    }
    
    if (femaleDevices.length === 0) {
        femaleDevicesDiv.innerHTML = '<div class="empty-state"><span class="icon">👩</span><p>Hakuna wanawake waliogunduliwa ndani
