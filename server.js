const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Twilio setup
const twilio = require('twilio');
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database file path
const DEVICES_DB_PATH = path.join(__dirname, 'data', 'devices.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize devices database
let devicesDatabase = [];

// Load devices from file
function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_DB_PATH)) {
            const data = fs.readFileSync(DEVICES_DB_PATH, 'utf8');
            devicesDatabase = JSON.parse(data);
            console.log(`✅ Loaded ${devicesDatabase.length} devices from database`);
        } else {
            // Sample data - replace with your actual data
            devicesDatabase = [
                {
                    deviceId: "sample-device-1",
                    deviceName: "Fatma iPhone",
                    phoneNumber: "+255712345678",
                    ownerName: "Fatma Hassan",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                },
                {
                    deviceId: "sample-device-2", 
                    deviceName: "Aisha Samsung",
                    phoneNumber: "+255765432109",
                    ownerName: "Aisha Juma",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                },
                {
                    deviceId: "sample-device-3",
                    deviceName: "Mariam Phone",
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
    }
}

// Save devices to file
function saveDevices() {
    try {
        fs.writeFileSync(DEVICES_DB_PATH, JSON.stringify(devicesDatabase, null, 2));
        console.log('💾 Devices database saved');
    } catch (error) {
        console.error('Error saving devices:', error);
    }
}

// Find phone number by device ID
function findPhoneByDeviceId(deviceId) {
    const device = devicesDatabase.find(d => 
        d.deviceId === deviceId || 
        d.deviceName?.toLowerCase() === deviceId?.toLowerCase()
    );
    return device;
}

// Add or update device
function addDevice(deviceId, deviceName, phoneNumber, ownerName, gender) {
    const existingIndex = devicesDatabase.findIndex(d => d.deviceId === deviceId);
    
    const deviceData = {
        deviceId,
        deviceName,
        phoneNumber,
        ownerName,
        gender,
        lastSeen: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
        devicesDatabase[existingIndex] = { ...devicesDatabase[existingIndex], ...deviceData };
    } else {
        devicesDatabase.push(deviceData);
    }
    
    saveDevices();
    return deviceData;
}

// Send SMS via Twilio
async function sendSMS(phoneNumber, message) {
    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });
        console.log(`📱 SMS sent to ${phoneNumber}: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('SMS error:', error);
        return { success: false, error: error.message };
    }
}

// Make a call via Twilio
async function makeCall(phoneNumber, message) {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say(message, { voice: 'alice', language: 'sw' });
        
        const call = await twilioClient.calls.create({
            twiml: twiml.toString(),
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        console.log(`📞 Call initiated to ${phoneNumber}: ${call.sid}`);
        return { success: true, callSid: call.sid };
    } catch (error) {
        console.error('Call error:', error);
        return { success: false, error: error.message };
    }
}

// API Routes
app.get('/api/devices', (req, res) => {
    res.json(devicesDatabase);
});

app.post('/api/devices', (req, res) => {
    const { deviceId, deviceName, phoneNumber, ownerName, gender } = req.body;
    
    if (!deviceId || !phoneNumber) {
        return res.status(400).json({ error: 'deviceId and phoneNumber are required' });
    }
    
    const device = addDevice(deviceId, deviceName, phoneNumber, ownerName, gender);
    res.json({ success: true, device });
});

app.delete('/api/devices/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    devicesDatabase = devicesDatabase.filter(d => d.deviceId !== deviceId);
    saveDevices();
    res.json({ success: true });
});

// WebSocket for real-time tracking
io.on('connection', (socket) => {
    console.log('🟢 Client connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi } = data;
        
        console.log(`📡 Device detected: ${deviceName || deviceId}, Distance: ${distance.toFixed(2)}m, RSSI: ${rssi}dBm`);
        
        // Check if within 10 meters
        if (distance <= 10) {
            // Find device in database
            const deviceInfo = findPhoneByDeviceId(deviceId);
            
            if (deviceInfo) {
                console.log(`✅ Found in database: ${deviceInfo.ownerName} (${deviceInfo.gender})`);
                
                // Prepare detection result
                const detection = {
                    deviceId,
                    deviceName: deviceInfo.deviceName,
                    phoneNumber: deviceInfo.phoneNumber,
                    ownerName: deviceInfo.ownerName,
                    gender: deviceInfo.gender,
                    distance: distance,
                    rssi: rssi,
                    timestamp: new Date().toISOString(),
                    within10Meters: true
                };
                
                // Send to all connected clients
                io.emit('detection-update', detection);
                
                // Auto-send notification if female
                if (deviceInfo.gender === 'female') {
                    const message = `Habari ${deviceInfo.ownerName}! Kifaa chako kimegunduliwa umbali wa ${distance.toFixed(1)}m. Karibu!`;
                    
                    // Optional: Send SMS automatically
                    // await sendSMS(deviceInfo.phoneNumber, message);
                    
                    // Emit notification
                    io.emit('notification', {
                        phoneNumber: deviceInfo.phoneNumber,
                        message: message,
                        distance: distance
                    });
                }
            } else {
                console.log(`⚠️ Device ${deviceId} not found in database`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance,
                    rssi,
                    message: 'Device not registered. Add to database first.'
                });
            }
        }
    });
    
    socket.on('send-sms', async (data) => {
        const { phoneNumber, message } = data;
        const result = await sendSMS(phoneNumber, message);
        socket.emit('sms-result', result);
    });
    
    socket.on('make-call', async (data) => {
        const { phoneNumber, message } = data;
        const result = await makeCall(phoneNumber, message);
        socket.emit('call-result', result);
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected:', socket.id);
    });
});

// Load database on startup
loadDevices();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
