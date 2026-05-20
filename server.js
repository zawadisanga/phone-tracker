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

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// ==================== GENDER DETECTION SYSTEM ====================

class GenderDetector {
    constructor() {
        this.femaleNames = new Set();
        this.maleNames = new Set();
        this.loadNames();
    }
    
    loadNames() {
        try {
            if (fs.existsSync(FEMALE_NAMES_DB_PATH)) {
                const data = JSON.parse(fs.readFileSync(FEMALE_NAMES_DB_PATH, 'utf8'));
                this.femaleNames = new Set(data.femaleNames || []);
                this.maleNames = new Set(data.maleNames || []);
            } else {
                this.initializeNames();
            }
        } catch (error) {
            this.initializeNames();
        }
    }
    
    initializeNames() {
        // Tanzanian female names
        const femaleList = [
            'fatma', 'aisha', 'mariam', 'zainab', 'halima', 'saada', 'asha',
            'mwanahamisi', 'khadija', 'amina', 'rahma', 'nadia', 'sharifa',
            'rehema', 'neema', 'upendo', 'subira', 'saumu', 'mwanaidi',
            'hawa', 'mwanaisha', 'aziza', 'samia', 'tatu', 'pili', 'hodan',
            'nasra', 'farida', 'zuhura', 'binti', 'mwana', 'safiya', 'rukiya',
            'saida', 'asia', 'biubwa', 'chausiku', 'faraj', 'hadija', 'hajra',
            'hawaa', 'hidaya', 'husna', 'imani', 'inaya', 'jannat', 'kamilia',
            'karima', 'kashifa', 'khatija', 'kulthum', 'lailat', 'latifa',
            'layla', 'lina', 'lulu', 'maimuna', 'malaika', 'maryam', 'mastura',
            'mawahib', 'mbaraka', 'moyo', 'mpenzi', 'mwanajuma', 'mwanakhamis'
        ];
        
        // Tanzanian male names
        const maleList = [
            'juma', 'hassan', 'ali', 'mohamed', 'salim', 'hamza', 'idd',
            'rashid', 'omar', 'saidi', 'bakari', 'ramadhan', 'kassim',
            'khamis', 'ibrahim', 'yusuf', 'islam', 'abdallah', 'samwel',
            'emanuel', 'john', 'peter', 'james', 'david', 'george',
            'william', 'charles', 'paul', 'mark', 'steven', 'andrew',
            'joseph', 'thomas', 'christopher', 'daniel', 'matthew',
            'anthony', 'donald', 'jeffrey', 'kenneth', 'lawrence'
        ];
        
        this.femaleNames = new Set(femaleList);
        this.maleNames = new Set(maleList);
        this.saveNames();
    }
    
    saveNames() {
        const data = {
            femaleNames: Array.from(this.femaleNames),
            maleNames: Array.from(this.maleNames),
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(FEMALE_NAMES_DB_PATH, JSON.stringify(data, null, 2));
    }
    
    detectGender(name) {
        if (!name || name === 'Unknown' || name === 'undefined') {
            return { gender: 'unknown', confidence: 0 };
        }
        
        const lowerName = name.toLowerCase().trim();
        
        // Method 1: Direct match
        if (this.femaleNames.has(lowerName)) {
            return { gender: 'female', confidence: 0.95, method: 'database' };
        }
        if (this.maleNames.has(lowerName)) {
            return { gender: 'male', confidence: 0.95, method: 'database' };
        }
        
        // Method 2: Partial match
        for (let femaleName of this.femaleNames) {
            if (lowerName.includes(femaleName) || femaleName.includes(lowerName)) {
                return { gender: 'female', confidence: 0.80, method: 'partial_match' };
            }
        }
        
        for (let maleName of this.maleNames) {
            if (lowerName.includes(maleName) || maleName.includes(lowerName)) {
                return { gender: 'male', confidence: 0.80, method: 'partial_match' };
            }
        }
        
        // Method 3: Name ending
        if (lowerName.endsWith('a') || lowerName.endsWith('i')) {
            return { gender: 'female', confidence: 0.65, method: 'name_ending' };
        }
        if (lowerName.endsWith('e') || lowerName.endsWith('o')) {
            return { gender: 'male', confidence: 0.65, method: 'name_ending' };
        }
        
        // Method 4: Prefix check
        if (lowerName.startsWith('mwan') || lowerName.startsWith('binti')) {
            return { gender: 'female', confidence: 0.90, method: 'prefix' };
        }
        
        return { gender: 'unknown', confidence: 0, method: 'none' };
    }
    
    addFemaleName(name) {
        this.femaleNames.add(name.toLowerCase());
        this.saveNames();
    }
}

// Initialize detector
const detector = new GenderDetector();

// ==================== DATABASE ====================

let femaleDevices = [];

function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_DB_PATH)) {
            const data = fs.readFileSync(DEVICES_DB_PATH, 'utf8');
            femaleDevices = JSON.parse(data);
            console.log(`✅ Loaded ${femaleDevices.length} female contacts`);
        } else {
            // Sample data
            femaleDevices = [
                {
                    deviceId: "FATMA-001",
                    deviceName: "Fatma's Phone",
                    phoneNumber: "+255712345678",
                    ownerName: "Fatma Hassan",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                },
                {
                    deviceId: "AISHA-002", 
                    deviceName: "Aisha's Phone",
                    phoneNumber: "+255765432109",
                    ownerName: "Aisha Juma",
                    gender: "female",
                    registeredAt: new Date().toISOString()
                }
            ];
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

function findFemale(deviceId, deviceName) {
    // Check by device ID
    let female = femaleDevices.find(d => d.deviceId.toLowerCase() === deviceId.toLowerCase());
    
    if (female) {
        female.lastSeen = new Date().toISOString();
        saveDevices();
        return female;
    }
    
    // Try to detect by name
    if (deviceName && deviceName !== 'Unknown') {
        const detection = detector.detectGender(deviceName);
        
        if (detection.gender === 'female' && detection.confidence > 0.6) {
            console.log(`🎯 Detected female: ${deviceName} (${detection.method})`);
            
            const newFemale = {
                deviceId: deviceId,
                deviceName: deviceName,
                phoneNumber: 'PENDING',
                ownerName: deviceName,
                gender: 'female',
                detectionMethod: detection.method,
                confidence: detection.confidence,
                autoDetected: true,
                registeredAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
            
            femaleDevices.push(newFemale);
            saveDevices();
            return newFemale;
        }
    }
    
    return null;
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

app.get('/api/detect', (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    const result = detector.detectGender(name);
    res.json(result);
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalFemales: femaleDevices.length,
        autoDetected: femaleDevices.filter(f => f.autoDetected).length,
        femaleNamesCount: detector.femaleNames.size,
        maleNamesCount: detector.maleNames.size
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        females_tracked: femaleDevices.length,
        timestamp: new Date().toISOString()
    });
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi } = data;
        
        console.log(`Device: ${deviceName}, Distance: ${distance?.toFixed(2)}m`);
        
        if (distance <= 10) {
            const female = findFemale(deviceId, deviceName);
            
            if (female) {
                console.log(`✅ FEMALE: ${female.ownerName} at ${distance.toFixed(2)}m`);
                
                io.emit('female-detected', {
                    deviceId: female.deviceId,
                    deviceName: female.deviceName,
                    phoneNumber: female.phoneNumber,
                    ownerName: female.ownerName,
                    distance: distance,
                    rssi: rssi,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log(`Not female: ${deviceName}`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance,
                    message: 'Not identified as female'
                });
            }
        }
    });
    
    socket.on('send-sms', (data) => {
        console.log(`📱 SMS to ${data.phoneNumber}: ${data.message}`);
        io.emit('sms-result', { success: true, message: 'SMS sent (demo)' });
    });
    
    socket.on('make-call', (data) => {
        console.log(`📞 Call to ${data.phoneNumber}`);
        io.emit('call-result', { success: true, message: 'Call initiated (demo)' });
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

loadDevices();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`👩 Tracking ${femaleDevices.length} females`);
    console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
});
