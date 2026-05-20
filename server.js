const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database path
const DEVICES_DB_PATH = path.join(__dirname, 'data', 'devices.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize database with female contacts only
let femaleDevicesDatabase = [];

function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_DB_PATH)) {
            const data = fs.readFileSync(DEVICES_DB_PATH, 'utf8');
            femaleDevicesDatabase = JSON.parse(data);
            console.log(`✅ Loaded ${femaleDevicesDatabase.length} female contacts`);
        } else {
            // Sample female contacts - REPLACE WITH YOUR DATA
            femaleDevicesDatabase = [
                {
                    deviceId: "FATMA-PHONE-001",
                    deviceName: "Fatma's iPhone",
                    phoneNumber: "+255712345678",
                    ownerName: "Fatma Hassan",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                },
                {
                    deviceId: "AISHA-SAMSUNG-002",
                    deviceName: "Aisha's Samsung",
                    phoneNumber: "+255765432109",
                    ownerName: "Aisha Juma",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                },
                {
                    deviceId: "MARIAM-HUAWEI-003",
                    deviceName: "Mariam's Phone",
                    phoneNumber: "+255756789012",
                    ownerName: "Mariam Salim",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                }
            ];
            saveDevices();
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        femaleDevicesDatabase = [];
    }
}

function saveDevices() {
    try {
        fs.writeFileSync(DEVICES_DB_PATH, JSON.stringify(femaleDevicesDatabase, null, 2));
        console.log('💾 Female contacts database saved');
    } catch (error) {
        console.error('Error saving devices:', error);
    }
}

// Only search in female database
function findFemaleByDeviceId(deviceId) {
    const female = femaleDevicesDatabase.find(d => 
        d.deviceId.toLowerCase() === deviceId.toLowerCase() || 
        d.deviceName?.toLowerCase() === deviceId?.toLowerCase()
    );
    return female;
}

// Add new female contact
function addFemaleContact(deviceId, deviceName, phoneNumber, ownerName) {
    const existingIndex = femaleDevicesDatabase.findIndex(d => d.deviceId === deviceId);
    
    const contactData = {
        deviceId,
        deviceName,
        phoneNumber,
        ownerName,
        gender: "female",
        lastSeen: new Date().toISOString(),
        registeredAt: existingIndex >= 0 ? femaleDevicesDatabase[existingIndex].registeredAt : new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
        femaleDevicesDatabase[existingIndex] = { ...femaleDevicesDatabase[existingIndex], ...contactData };
    } else {
        femaleDevicesDatabase.push(contactData);
    }
    
    saveDevices();
    return contactData;
}

// Send SMS (mock for Heroku - no Twilio required)
async function sendSMSToFemale(phoneNumber, ownerName, distance) {
    const message = `Habari ${ownerName}! Kifaa chako kimegunduliwa umbali wa ${distance.toFixed(1)} mita. Uko karibu na tracker yetu.`;
    console.log(`📱 [SMS TO FEMALE] ${phoneNumber}: ${message}`);
    
    // Kwenye production, unaweza ku-add Twilio hapa
    return { success: true, message: "SMS sent successfully", to: phoneNumber };
}

// Make call (mock for Heroku)
async function callFemale(phoneNumber, ownerName, distance) {
    console.log(`📞 [CALL TO FEMALE] ${phoneNumber}: Calling ${ownerName} - Distance ${distance.toFixed(1)}m`);
    return { success: true, message: "Call initiated", to: phoneNumber };
}

// API Routes
app.get('/api/females', (req, res) => {
    res.json({ 
        success: true, 
        count: femaleDevicesDatabase.length,
        females: femaleDevicesDatabase 
    });
});

app.post('/api/females', (req, res) => {
    const { deviceId, deviceName, phoneNumber, ownerName } = req.body;
    
    if (!deviceId || !phoneNumber || !ownerName) {
        return res.status(400).json({ 
            error: 'deviceId, phoneNumber, and ownerName are required' 
        });
    }
    
    const contact = addFemaleContact(deviceId, deviceName, phoneNumber, ownerName);
    res.json({ success: true, message: "Female contact added", contact });
});

app.delete('/api/females/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const removed = femaleDevicesDatabase.find(d => d.deviceId === deviceId);
    femaleDevicesDatabase = femaleDevicesDatabase.filter(d => d.deviceId !== deviceId);
    saveDevices();
    res.json({ 
        success: true, 
        message: removed ? "Female contact removed" : "Contact not found",
        removed 
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        females_tracked: femaleDevicesDatabase.length,
        timestamp: new Date().toISOString() 
    });
});

// WebSocket - Track ONLY female devices
io.on('connection', (socket) => {
    console.log('🟢 Scanner connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi } = data;
        
        console.log(`📡 Scanning: ${deviceName || deviceId} at ${distance.toFixed(2)}m`);
        
        // ONLY process if within 10 meters
        if (distance <= 10) {
            // Check if it's a female device
            const femaleContact = findFemaleByDeviceId(deviceId);
            
            if (femaleContact) {
                console.log(`✅ FEMALE DETECTED: ${femaleContact.ownerName} at ${distance.toFixed(2)}m`);
                
                // Prepare detection data
                const detection = {
                    deviceId: femaleContact.deviceId,
                    deviceName: femaleContact.deviceName,
                    phoneNumber: femaleContact.phoneNumber,
                    ownerName: femaleContact.ownerName,
                    gender: "female",
                    distance: distance,
                    rssi: rssi,
                    timestamp: new Date().toISOString(),
                    within10Meters: true
                };
                
                // Broadcast to all connected clients
                io.emit('female-detected', detection);
                
                // Auto-send notification (optional - uncomment if needed)
                // await sendSMSToFemale(femaleContact.phoneNumber, femaleContact.ownerName, distance);
                
                console.log(`👩 Sent update for: ${femaleContact.ownerName} (${femaleContact.phoneNumber})`);
            } else {
                console.log(`⚠️ Device ${deviceId} not in female database - IGNORED`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance,
                    message: "Device not registered as female. Add to database first."
                });
            }
        } else {
            console.log(`📏 Device at ${distance.toFixed(2)}m - outside 10m range, ignoring...`);
        }
    });
    
    // Manual communication with detected females
    socket.on('send-sms-to-female', async (data) => {
        const { phoneNumber, ownerName, distance } = data;
        const result = await sendSMSToFemale(phoneNumber, ownerName, distance);
        socket.emit('sms-result', result);
    });
    
    socket.on('call-female', async (data) => {
        const { phoneNumber, ownerName, distance } = data;
        const result = await callFemale(phoneNumber, ownerName, distance);
        socket.emit('call-result', result);
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 Scanner disconnected:', socket.id);
    });
});

// Initialize and start
loadDevices();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Phone Tracker (Female Only) running on http://0.0.0.0:${PORT}`);
    console.log(`👩 Tracking ${femaleDevicesDatabase.length} female contacts`);
    console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
});
