const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database paths
const DEVICES_DB_PATH = path.join(__dirname, 'data', 'devices.json');
const FEMALE_NAMES_DB_PATH = path.join(__dirname, 'data', 'female_names.json');
const AUTO_ADD_LOG = path.join(__dirname, 'data', 'auto_add_log.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// ==================== COMPLETE FEMALE NAMES DATABASE ====================

let femaleNamesDatabase = new Set();
let maleNamesDatabase = new Set();
let autoAddedFemales = [];

// Initialize female names (Tanzanian + International)
function initializeFemaleNames() {
    const femaleNames = [
        // Tanzanian Female Names
        'fatma', 'aisha', 'mariam', 'zainab', 'halima', 'saada', 'asha', 'mwanahamisi',
        'khadija', 'amina', 'rahma', 'nadia', 'sharifa', 'rehema', 'neema', 'upendo',
        'subira', 'saumu', 'mwanaidi', 'hawa', 'mwanaisha', 'aziza', 'samia', 'tatu',
        'pili', 'hodan', 'nasra', 'farida', 'zuhura', 'binti', 'mwana', 'safiya',
        'rukiya', 'saida', 'asia', 'biubwa', 'chausiku', 'hadija', 'hajra', 'hawaa',
        'hidaya', 'husna', 'imani', 'inaya', 'jannat', 'kamilia', 'karima', 'kashifa',
        'khatija', 'kulthum', 'latifa', 'layla', 'lina', 'lulu', 'maimuna', 'malaika',
        'maryam', 'mawahib', 'mwanajuma', 'nabila', 'najma', 'noor', 'nura', 'ramla',
        'sabah', 'sakina', 'salama', 'salma', 'samira', 'sanaa', 'sarah', 'selina',
        'shakira', 'shamim', 'siti', 'sofia', 'suhaila', 'sumaiya', 'warda', 'waridi',
        'yasmin', 'zahra', 'zakia', 'zawadi', 'zuhura', 'rahma', 'salha', 'thuraya',
        
        // Common Female Names
        'jane', 'mary', 'lisa', 'sarah', 'emma', 'olivia', 'ava', 'isabella', 'sophia',
        'mia', 'charlotte', 'amelia', 'harper', 'evelyn', 'abigail', 'emily', 'elizabeth',
        'sofia', 'avery', 'ella', 'madison', 'scarlett', 'victoria', 'aria', 'grace',
        'chloe', 'camila', 'penelope', 'riley', 'layla', 'lillian', 'nora', 'zoe',
        'natalie', 'emilia', 'eleanor', 'hannah', 'lily', 'violet', 'aurora', 'savannah',
        'audrey', 'bella', 'brooklyn', 'claire', 'skylar', 'lucy', 'paisley', 'everly',
        'anna', 'caroline', 'nova', 'genesis', 'isla', 'maya', 'willow', 'kylie',
        'ivy', 'opal', 'june', 'ruby', 'rose', 'luna', 'iris', 'poppy', 'daisy',
        'lily', 'rosie', 'millie', 'florence', 'alice', 'beatrice', 'clara', 'diana',
        'edith', 'fiona', 'georgia', 'heidi', 'iris', 'julia', 'kate', 'laura'
    ];
    
    femaleNames.forEach(name => femaleNamesDatabase.add(name.toLowerCase()));
    
    // Load existing database if any
    try {
        if (fs.existsSync(FEMALE_NAMES_DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(FEMALE_NAMES_DB_PATH, 'utf8'));
            data.femaleNames?.forEach(n => femaleNamesDatabase.add(n.toLowerCase()));
            console.log(`📚 Loaded ${femaleNamesDatabase.size} female names from database`);
        } else {
            saveFemaleNamesDatabase();
        }
    } catch (error) {
        console.error('Error loading female names:', error);
    }
    
    console.log(`📚 Total female names in system: ${femaleNamesDatabase.size}`);
}

function saveFemaleNamesDatabase() {
    const data = {
        femaleNames: Array.from(femaleNamesDatabase),
        updatedAt: new Date().toISOString(),
        total: femaleNamesDatabase.size
    };
    fs.writeFileSync(FEMALE_NAMES_DB_PATH, JSON.stringify(data, null, 2));
}

// ==================== DEVICE DATABASE ====================

let femaleDevices = [];

function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_DB_PATH)) {
            const data = fs.readFileSync(DEVICES_DB_PATH, 'utf8');
            femaleDevices = JSON.parse(data);
            console.log(`✅ Loaded ${femaleDevices.length} female contacts`);
        } else {
            femaleDevices = [];
            saveDevices();
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        femaleDevices = [];
    }
}

function saveDevices() {
    try {
        fs.writeFileSync(DEVICES_DB_PATH, JSON.stringify(femaleDevices, null, 2));
    } catch (error) {
        console.error('Error saving devices:', error);
    }
}

// ==================== INTELLIGENT FEMALE DETECTION ====================

function isFemaleName(name) {
    if (!name || name === 'Unknown' || name === 'undefined' || name === 'null') {
        return false;
    }
    
    const lowerName = name.toLowerCase().trim();
    
    // Direct match
    if (femaleNamesDatabase.has(lowerName)) {
        return true;
    }
    
    // Check if name contains female name
    for (let femaleName of femaleNamesDatabase) {
        if (lowerName.includes(femaleName)) {
            return true;
        }
    }
    
    // Check if name ends with female indicator
    if (lowerName.endsWith('a') || lowerName.endsWith('i')) {
        // Additional check - not all names ending with a are female
        const maleExceptions = ['juma', 'hassan', 'ali', 'mohamed', 'salim', 'rashid', 'omar'];
        for (let exception of maleExceptions) {
            if (lowerName.includes(exception)) {
                return false;
            }
        }
        return true;
    }
    
    return false;
}

function extractFemaleName(deviceName) {
    if (!deviceName) return null;
    
    const lowerName = deviceName.toLowerCase();
    
    // Try to find known female name in device name
    for (let femaleName of femaleNamesDatabase) {
        if (lowerName.includes(femaleName)) {
            return femaleName.charAt(0).toUpperCase() + femaleName.slice(1);
        }
    }
    
    // If name ends with a or i, use it
    if (lowerName.endsWith('a') || lowerName.endsWith('i')) {
        const words = deviceName.split(/[\s']+/);
        for (let word of words) {
            if (word.toLowerCase().endsWith('a') || word.toLowerCase().endsWith('i')) {
                return word;
            }
        }
        return deviceName;
    }
    
    return null;
}

// AUTO-ADD FEMALE WHEN DETECTED
function autoAddFemale(deviceId, deviceName, phoneNumber = null) {
    // Check if already exists
    const existing = femaleDevices.find(d => d.deviceId === deviceId);
    if (existing) {
        existing.lastSeen = new Date().toISOString();
        if (phoneNumber && existing.phoneNumber === 'PENDING') {
            existing.phoneNumber = phoneNumber;
        }
        saveDevices();
        return existing;
    }
    
    // Extract female name from device name
    const femaleName = extractFemaleName(deviceName);
    
    if (!femaleName) {
        console.log(`⚠️ Could not extract female name from: ${deviceName}`);
        return null;
    }
    
    // Auto add to database
    const newFemale = {
        deviceId: deviceId,
        deviceName: deviceName,
        phoneNumber: phoneNumber || 'PENDING_ADD_PHONE',
        ownerName: femaleName,
        gender: 'female',
        autoAdded: true,
        autoAddedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        registeredAt: new Date().toISOString()
    };
    
    femaleDevices.push(newFemale);
    saveDevices();
    
    // Add name to female names database for future detection
    const nameToAdd = femaleName.toLowerCase();
    if (!femaleNamesDatabase.has(nameToAdd)) {
        femaleNamesDatabase.add(nameToAdd);
        saveFemaleNamesDatabase();
        console.log(`📚 Auto-learned new female name: ${femaleName}`);
    }
    
    console.log(`✨ AUTO-ADDED FEMALE: ${femaleName} (${deviceId})`);
    
    // Log auto add
    logAutoAdd(femaleName, deviceId, deviceName);
    
    return newFemale;
}

function logAutoAdd(name, deviceId, deviceName) {
    try {
        let logs = [];
        if (fs.existsSync(AUTO_ADD_LOG)) {
            logs = JSON.parse(fs.readFileSync(AUTO_ADD_LOG, 'utf8'));
        }
        logs.unshift({
            name: name,
            deviceId: deviceId,
            deviceName: deviceName,
            timestamp: new Date().toISOString()
        });
        // Keep last 100 logs
        if (logs.length > 100) logs = logs.slice(0, 100);
        fs.writeFileSync(AUTO_ADD_LOG, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error logging auto add:', error);
    }
}

// ==================== SMS & CALL FUNCTIONS ====================

async function sendSMSToFemale(phoneNumber, ownerName, message) {
    console.log(`📱 [SMS] To: ${phoneNumber} | ${ownerName}: ${message}`);
    
    // In production, integrate with Twilio or Africa's Talking
    // For now, just log and return success
    return { 
        success: true, 
        message: `SMS sent to ${ownerName}`,
        details: message
    };
}

async function callFemale(phoneNumber, ownerName) {
    console.log(`📞 [CALL] To: ${phoneNumber} | Calling ${ownerName}`);
    return { 
        success: true, 
        message: `Call initiated to ${ownerName}`
    };
}

// ==================== API ROUTES ====================

app.get('/api/females', (req, res) => {
    res.json({
        success: true,
        count: femaleDevices.length,
        females: femaleDevices
    });
});

app.post('/api/females', (req, res) => {
    const { deviceId, deviceName, phoneNumber, ownerName } = req.body;
    
    if (!deviceId || !phoneNumber) {
        return res.status(400).json({ error: 'deviceId and phoneNumber required' });
    }
    
    const existing = femaleDevices.find(d => d.deviceId === deviceId);
    
    if (existing) {
        existing.phoneNumber = phoneNumber;
        existing.ownerName = ownerName || existing.ownerName;
        existing.lastSeen = new Date().toISOString();
        saveDevices();
        res.json({ success: true, message: 'Updated', female: existing });
    } else {
        const newFemale = {
            deviceId,
            deviceName: deviceName || deviceId,
            phoneNumber,
            ownerName: ownerName || deviceName || deviceId,
            gender: 'female',
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
        femaleDevices.push(newFemale);
        saveDevices();
        res.json({ success: true, message: 'Added', female: newFemale });
    }
});

app.delete('/api/females/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    femaleDevices = femaleDevices.filter(d => d.deviceId !== deviceId);
    saveDevices();
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalFemales: femaleDevices.length,
        autoAdded: femaleDevices.filter(f => f.autoAdded).length,
        femaleNamesInDB: femaleNamesDatabase.size,
        pendingPhones: femaleDevices.filter(f => f.phoneNumber === 'PENDING_ADD_PHONE').length
    });
});

app.get('/api/auto-add-log', (req, res) => {
    try {
        if (fs.existsSync(AUTO_ADD_LOG)) {
            const logs = JSON.parse(fs.readFileSync(AUTO_ADD_LOG, 'utf8'));
            res.json({ success: true, logs });
        } else {
            res.json({ success: true, logs: [] });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        females_tracked: femaleDevices.length,
        female_names_count: femaleNamesDatabase.size,
        auto_add_enabled: true,
        timestamp: new Date().toISOString()
    });
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
    console.log('🟢 Client connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi, phoneNumber } = data;
        
        console.log(`📡 Device detected: ${deviceName || deviceId}, Distance: ${distance?.toFixed(2) || '?'}m`);
        
        // Check if within 10 meters
        if (distance <= 10) {
            // Check if device name indicates female
            if (isFemaleName(deviceName)) {
                console.log(`🎯 FEMALE DETECTED: ${deviceName}`);
                
                // AUTO-ADD TO DATABASE
                const female = autoAddFemale(deviceId, deviceName, phoneNumber);
                
                if (female) {
                    // Emit to all clients
                    io.emit('female-auto-detected', {
                        deviceId: female.deviceId,
                        deviceName: female.deviceName,
                        phoneNumber: female.phoneNumber,
                        ownerName: female.ownerName,
                        distance: distance,
                        rssi: rssi,
                        autoAdded: true,
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log(`✅ AUTO-ADDED: ${female.ownerName} to database`);
                }
            } else {
                console.log(`⚠️ Not female: ${deviceName}`);
                io.emit('non-female-detected', {
                    deviceId,
                    deviceName,
                    distance,
                    message: "Device not identified as female"
                });
            }
        }
    });
    
    socket.on('send-sms-to-female', async (data) => {
        const result = await sendSMSToFemale(data.phoneNumber, data.ownerName, data.message);
        socket.emit('sms-result', result);
    });
    
    socket.on('call-female', async (data) => {
        const result = await callFemale(data.phoneNumber, data.ownerName);
        socket.emit('call-result', result);
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

initializeFemaleNames();
loadDevices();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 FEMALE AUTO-DETECTION SYSTEM v3.0');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`👩 Females in database: ${femaleDevices.length}`);
    console.log(`📚 Female names known: ${femaleNamesDatabase.size}`);
    console.log(`✨ AUTO-ADD: ENABLED - Will auto-add any detected female`);
    console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
    console.log('='.repeat(60));
});
