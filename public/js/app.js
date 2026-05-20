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
        femaleDevicesDiv.innerHTML = '<div class="empty-state"><span class="icon">👩</span><p>Hakuna wanawake waliogunduliwa ndani ya mita 10</p></div>';
        return;
    }
    
    femaleDevicesDiv.innerHTML = femaleDevices.map(device => `
        <div class="device-card female">
            <h3>👩 ${device.ownerName || device.deviceName}</h3>
            <p><strong>📞 Phone:</strong> <span class="phone">${device.phoneNumber}</span></p>
            <p><strong>📏 Distance:</strong> <span class="distance">${device.distance?.toFixed(1) || '?'} meters</span></p>
            <p><strong>⏱️ Detected:</strong> ${new Date(device.timestamp).toLocaleTimeString()}</p>
            <button onclick="copyPhone('${device.phoneNumber}')" class="btn btn-outline" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">📋 Copy Phone</button>
        </div>
    `).join('');
}

// Load and display device database
async function loadDeviceDatabase() {
    try {
        const response = await fetch('/api/devices');
        const devices = await response.json();
        
        if (devices.length === 0) {
            deviceListDiv.innerHTML = '<p>Hakuna vifaa kwenye database.</p>';
            return;
        }
        
        deviceListDiv.innerHTML = devices.map(device => `
            <div class="device-card ${device.gender === 'female' ? 'female' : ''}">
                <h3>${device.deviceName || device.deviceId}</h3>
                <p><strong>ID:</strong> ${device.deviceId}</p>
                <p><strong>📞 Phone:</strong> ${device.phoneNumber}</p>
                <p><strong>👤 Owner:</strong> ${device.ownerName}</p>
                <p><strong>🚻 Gender:</strong> ${device.gender}</p>
                <button onclick="deleteDevice('${device.deviceId}')" class="btn btn-secondary" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">🗑️ Delete</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading database:', error);
    }
}

// Add new device
async function addDevice() {
    const deviceId = document.getElementById('newDeviceId').value;
    const deviceName = document.getElementById('newDeviceName').value;
    const phoneNumber = document.getElementById('newPhoneNumber').value;
    const ownerName = document.getElementById('newOwnerName').value;
    const gender = document.getElementById('newGender').value;
    
    if (!deviceId || !phoneNumber) {
        showToast('Device ID na Phone Number zinahitajika', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, deviceName, phoneNumber, ownerName, gender })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Kifaa kimeongezwa!', 'success');
            document.getElementById('newDeviceId').value = '';
            document.getElementById('newDeviceName').value = '';
            document.getElementById('newPhoneNumber').value = '';
            document.getElementById('newOwnerName').value = '';
            loadDeviceDatabase();
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error adding device', 'error');
    }
}

// Delete device
window.deleteDevice = async (deviceId) => {
    if (!confirm('Una uhakika unataka kufuta kifaa hiki?')) return;
    
    try {
        const response = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Kifaa kimefutwa!', 'success');
            loadDeviceDatabase();
        }
    } catch (error) {
        showToast('Error deleting device', 'error');
    }
};

// Copy phone number
window.copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    showToast(`Namba ${phone} imenakiliwa!`, 'success');
};

// Send SMS
async function sendSMS() {
    const phoneNumber = document.getElementById('commsPhone').value;
    const message = document.getElementById('commsMessage').value;
    
    if (!phoneNumber || !message) {
        showToast('Tafadhali jaza namba na ujumbe', 'error');
        return;
    }
    
    commsResult.innerHTML = 'Inatuma SMS...';
    commsResult.className = 'comms-result';
    
    socket.emit('send-sms', { phoneNumber, message });
}

// Make call
async function makeCall() {
    const phoneNumber = document.getElementById('commsPhone').value;
    const message = document.getElementById('commsMessage').value || 'Habari, hii ni simu kutoka kwa mfumo wa utambuzi wa vifaa.';
    
    if (!phoneNumber) {
        showToast('Tafadhali ingiza namba ya simu', 'error');
        return;
    }
    
    commsResult.innerHTML = 'Inapiga simu...';
    commsResult.className = 'comms-result';
    
    socket.emit('make-call', { phoneNumber, message });
}

// Show toast notification
function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Socket event handlers
socket.on('detection-update', (data) => {
    console.log('Detection update:', data);
    updateDetectedDevices(data);
    
    if (data.gender === 'female') {
        updateFemaleDevices(data);
    }
});

socket.on('unknown-device', (data) => {
    updateDetectedDevices(data);
    showToast(`Kifaa kipya kimegunduliwa: ${data.deviceName || data.deviceId}`, 'warning');
});

socket.on('notification', (data) => {
    showToast(`📱 Notification kwa ${data.phoneNumber}: ${data.message}`, 'success');
});

socket.on('sms-result', (data) => {
    if (data.success) {
        commsResult.innerHTML = `✅ SMS imetumwa! SID: ${data.sid}`;
        commsResult.className = 'comms-result success';
    } else {
        commsResult.innerHTML = `❌ Kosa: ${data.error}`;
        commsResult.className = 'comms-result error';
    }
});

socket.on('call-result', (data) => {
    if (data.success) {
        commsResult.innerHTML = `✅ Simu inapigwa! Call SID: ${data.callSid}`;
        commsResult.className = 'comms-result success';
    } else {
        commsResult.innerHTML = `❌ Kosa: ${data.error}`;
        commsResult.className = 'comms-result error';
    }
});

// Event listeners
startScanBtn.addEventListener('click', startScanning);
stopScanBtn.addEventListener('click', stopScanning);
showDbBtn.addEventListener('click', () => {
    const isVisible = deviceDatabaseDiv.style.display === 'block';
    deviceDatabaseDiv.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) loadDeviceDatabase();
});
addDeviceBtn.addEventListener('click', addDevice);
sendSmsBtn.addEventListener('click', sendSMS);
makeCallBtn.addEventListener('click', makeCall);

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize app
initScanner();
console.log('Phone Tracker App initialized - Tracking within 10 meters');
