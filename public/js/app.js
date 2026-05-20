const socket = io();

const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const scanStatus = document.getElementById('scanStatus');
const statusText = document.getElementById('statusText');
const distanceInfo = document.getElementById('distanceInfo');
const femaleDevicesDiv = document.getElementById('femaleDevices');
const showDbBtn = document.getElementById('showDbBtn');
const deviceDatabaseDiv = document.getElementById('deviceDatabase');
const deviceListDiv = document.getElementById('deviceList');
const addDeviceBtn = document.getElementById('addDeviceBtn');
const sendSmsBtn = document.getElementById('sendSmsBtn');
const makeCallBtn = document.getElementById('makeCallBtn');
const commsResult = document.getElementById('commsResult');

let scanner = null;
let detectedFemales = [];
let isScanning = false;

function initScanner() {
    scanner = new FemaleBluetoothScanner();
    
    scanner.onFemaleDetected = (device) => {
        console.log('Female detected within 10m:', device);
        socket.emit('device-detected', {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            distance: device.distance,
            rssi: device.rssi
        });
    };
    
    scanner.onDistanceUpdate = (update) => {
        updateDistanceDisplay(update);
    };
    
    scanner.onError = (error) => {
        showToast(error, 'error');
        stopScanning();
    };
}

function updateDistanceDisplay(update) {
    const isWithin10m = update.distance <= 10;
    distanceInfo.innerHTML = `
        <strong>📊 Kifaa:</strong> ${update.deviceName}<br>
        <strong>📡 Ishara:</strong> ${update.rssi} dBm<br>
        <strong>📏 Umbali:</strong> 
        <span style="color: ${isWithin10m ? '#28a745' : '#dc3545'}; font-weight: bold;">
            ${update.distance.toFixed(1)} mita
        </span>
        ${isWithin10m ? '<br>✅ <strong>NDANI YA MITA 10 - ANAWEZA KUGUNDULIKA!</strong>' : ''}
    `;
}

async function startScanning() {
    if (isScanning) {
        showToast('Utafutaji tayari unaendelea', 'warning');
        return;
    }
    
    statusText.textContent = 'Inatafuta Wanawake...';
    scanStatus.className = 'indicator scanning';
    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    
    const success = await scanner.startScanning();
    
    if (success) {
        isScanning = true;
        statusText.textContent = 'Inatafuta wanawake karibu...';
        showToast('Utafutaji umeanza! Wanawake ndani ya mita 10 watagundulika', 'success');
    } else {
        stopScanning();
    }
}

function stopScanning() {
    if (scanner) scanner.stopScanning();
    isScanning = false;
    statusText.textContent = 'Utafutaji umesimama';
    scanStatus.className = 'indicator stopped';
    startScanBtn.disabled = false;
    stopScanBtn.disabled = true;
}

function updateFemaleDevices(female) {
    const exists = detectedFemales.find(f => f.deviceId === female.deviceId);
    if (!exists) {
        detectedFemales.unshift(female);
        if (detectedFemales.length > 20) detectedFemales.pop();
    } else {
        exists.lastSeen = female.timestamp;
        exists.distance = female.distance;
    }
    
    if (detectedFemales.length === 0) {
        femaleDevicesDiv.innerHTML = '<div class="empty-state"><span class="icon">👩</span><p>Hakuna mwanamke aliye karibu (mita 10)</p></div>';
        return;
    }
    
    femaleDevicesDiv.innerHTML = detectedFemales.map(female => `
        <div class="device-card">
            <h3>👩 ${female.ownerName}</h3>
            <p><strong>📞 Phone:</strong> <span class="phone">${female.phoneNumber}</span></p>
            <p><strong>📏 Umbali:</strong> <span class="distance">${female.distance?.toFixed(1)} mita</span></p>
            <p><strong>⏱️ Aligunduliwa:</strong> ${new Date(female.timestamp).toLocaleTimeString()}</p>
            <button onclick="copyPhone('${female.phoneNumber}')" class="btn btn-outline" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">
                📋 Nakili Namba
            </button>
            <button onclick="fillComms('${female.phoneNumber}', '${female.ownerName}')" class="btn btn-primary" style="margin-top: 10px; padding: 5px 10px; font-size: 12px; margin-left: 5px;">
                💬 Wasiliana
            </button>
        </div>
    `).join('');
}

async function loadFemaleDatabase() {
    try {
        const response = await fetch('/api/females');
        const data = await response.json();
        
        if (data.females.length === 0) {
            deviceListDiv.innerHTML = '<p>Hakuna wanawake kwenye database. Ongeza mmoja.</p>';
            return;
        }
        
        deviceListDiv.innerHTML = data.females.map(female => `
            <div class="device-card">
                <h3>👩 ${female.ownerName}</h3>
                <p><strong>Device ID:</strong> ${female.deviceId}</p>
                <p><strong>📞 Phone:</strong> ${female.phoneNumber}</p>
                <p><strong>📱 Device:</strong> ${female.deviceName || '-'}</p>
                <button onclick="deleteFemale('${female.deviceId}')" class="btn btn-secondary" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">
                    🗑️ Futa
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading database:', error);
    }
}

async function addFemale() {
    const deviceId = document.getElementById('newDeviceId').value;
    const deviceName = document.getElementById('newDeviceName').value;
    const phoneNumber = document.getElementById('newPhoneNumber').value;
    const ownerName = document.getElementById('newOwnerName').value;
    
    if (!deviceId || !phoneNumber || !ownerName) {
        showToast('Tafadhali jaza Device ID, Namba ya Simu, na Jina Kamili', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/females', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, deviceName, phoneNumber, ownerName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ ${ownerName} ameongezwa kwenye database!`, 'success');
            document.getElementById('newDeviceId').value = '';
            document.getElementById('newDeviceName').value = '';
            document.getElementById('newPhoneNumber').value = '';
            document.getElementById('newOwnerName').value = '';
            loadFemaleDatabase();
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error adding female contact', 'error');
    }
}

window.deleteFemale = async (deviceId) => {
    if (!confirm('Una uhakika unataka kumfuta mwanamke huyu kwenye database?')) return;
    
    try {
        const response = await fetch(`/api/females/${deviceId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Mwanamke amefutwa!', 'success');
            loadFemaleDatabase();
        }
    } catch (error) {
        showToast('Error deleting contact', 'error');
    }
};

window.copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    showToast(`Namba ${phone} imenakiliwa!`, 'success');
};

window.fillComms = (phone, name) => {
    document.getElementById('commsPhone').value = phone;
    document.getElementById('commsMessage').value = `Habari ${name}, nimekugundua kupitia tracker yetu. Uko karibu nami!`;
    showToast(`Tayari kuwasiliana na ${name}`, 'success');
};

function sendSMSToFemale() {
    const phoneNumber = document.getElementById('commsPhone').value;
    const message = document.getElementById('commsMessage').value;
    
    if (!phoneNumber || !message) {
        showToast('Tafadhali jaza namba na ujumbe', 'error');
        return;
    }
    
    commsResult.innerHTML = 'Inatuma SMS kwa mwanamke...';
    commsResult.className = 'comms-result';
    
    socket.emit('send-sms-to-female', { phoneNumber, message });
}

function callFemale() {
    const phoneNumber = document.getElementById('commsPhone').value;
    const message = document.getElementById('commsMessage').value;
    
    if (!phoneNumber) {
        showToast('Tafadhali ingiza namba ya simu', 'error');
        return;
    }
    
    commsResult.innerHTML = 'Inampigia simu mwanamke...';
    commsResult.className = 'comms-result';
    
    socket.emit('call-female', { phoneNumber, message });
}

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
    setTimeout(() => toast.remove(), 3000);
}

// Socket events - Listen ONLY for female detections
socket.on('female-detected', (data) => {
    console.log('👩 Female detected:', data);
    updateFemaleDevices(data);
    showToast(`👩 ${data.ownerName} amegunduliwa umbali wa ${data.distance.toFixed(1)}m!`, 'success');
});

socket.on('unknown-device', (data) => {
    console.log('Unknown device (not female):', data);
    showToast(`⚠️ Kifaa kimegunduliwa lakini si mwanamke: ${data.deviceName}`, 'warning');
});

socket.on('sms-result', (data) => {
    if (data.success) {
        commsResult.innerHTML = `✅ SMS imetumwa kwa mwanamke! ${data.message}`;
        commsResult.className = 'comms-result success';
    } else {
        commsResult.innerHTML = `❌ Kosa: ${data.error}`;
        commsResult.className = 'comms-result error';
    }
});

socket.on('call-result', (data) => {
    if (data.success) {
        commsResult.innerHTML = `✅ Simu inampigia mwanamke! ${data.message}`;
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
    if (!isVisible) loadFemaleDatabase();
});
addDeviceBtn.addEventListener('click', addFemale);
sendSmsBtn.addEventListener('click', sendSMSToFemale);
makeCallBtn.addEventListener('click', callFemale);

// Initialize
initScanner();
console.log('✅ Female Phone Tracker Ready - Tracking only women within 10 meters');
