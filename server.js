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
        this.cache = new Map();
        this.loadNames();
        console.log('🤖 Gender Detector Initialized');
    }
    
    loadNames() {
        try {
            if (fs.existsSync(FEMALE_NAMES_DB_PATH)) {
                const data = JSON.parse(fs.readFileSync(FEMALE_NAMES_DB_PATH, 'utf8'));
                this.femaleNames = new Set(data.femaleNames || []);
                this.maleNames = new Set(data.maleNames || []);
                console.log(`📚 Loaded ${this.femaleNames.size} female names`);
            } else {
                this.initializeTanzanianNames();
            }
        } catch (error) {
            console.error('Error loading names:', error);
            this.initializeTanzanianNames();
        }
    }
    
    initializeTanzanianNames() {
        // Tanzanian female names
        const femaleList = [
            'fatma', 'aisha', 'mariam', 'zainab', 'halima', 'saada', 'asha',
            'mwanahamisi', 'khadija', 'amina', 'rahma', 'nadia', 'sharifa',
            'rehema', 'neema', 'upendo', 'subira', 'saumu', 'mwanaidi',
            'hawa', 'mwanaisha', 'aziza', 'samia', 'tatu', 'pili', 'hodan',
            'nasra', 'farida', 'zuhura', 'binti', 'mwana', 'safiya', 'rukiya',
            'saida', 'asia', 'biubwa', 'chausiku', 'hadija', 'hajra',
            'hidaya', 'husna', 'imani', 'inaya', 'jannat', 'kamilia',
            'karima', 'khatija', 'latifa', 'layla', 'lina', 'lulu',
            'maimuna', 'malaika', 'maryam', 'mawahib', 'mwanajuma',
            'nabila', 'najma', 'noor', 'nura', 'rahma', 'ramla',
            'sabah', 'safiya', 'sakina', 'salama', 'salma', 'samira',
            'sanaa', 'sarah', 'selina', 'shakira', 'shamim', 'siti',
            'sofia', 'suhaila', 'sumaiya', 'warda', 'waridi', 'yasmin',
            'zahra', 'zakia', 'zawadi', 'zuhura'
        ];
        
        // Tanzanian male names
        const maleList = [
            'juma', 'hassan', 'ali', 'mohamed', 'salim', 'hamza', 'idd',
            'rashid', 'omar', 'saidi', 'bakari', 'ramadhan', 'kassim',
            'khamis', 'ibrahim', 'yusuf', 'islam', 'abdallah', 'samwel',
            'emanuel', 'john', 'peter', 'james', 'david', 'george',
            'william', 'charles', 'paul', 'mark', 'steven', 'andrew',
            'joseph', 'thomas', 'christopher', 'daniel', 'matthew',
            'anthony', 'donald', 'michael', 'patrick', 'richard',
            'ahmed', 'amir', 'anwar', 'ashraf', 'aziz', 'bashir',
            'farid', 'faris', 'hakim', 'hamisi', 'haruna', 'hashim',
            'husein', 'ismail', 'jabir', 'jamal', 'khalid', 'mahmoud',
            'masoud', 'musa', 'mustafa', 'nassir', 'nuru', 'osman',
            'saad', 'saeed', 'seif', 'shabani', 'suleiman', 'sultan',
            'twaha', 'yahya', 'yohana', 'yusuph', 'zacharia', 'zakaria'
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
            return { gender: 'unknown', confidence: 0, method: 'none' };
        }
        
        const lowerName = name.toLowerCase().trim();
        
        // Check cache
        if (this.cache.has(lowerName)) {
            return this.cache.get(lowerName);
        }
        
        let result = { gender: 'unknown', confidence: 0, methods: [] };
        
        // Method 1: Direct database match
        if (this.femaleNames.has(lowerName)) {
            result = { gender: 'female', confidence: 0.98, method: 'database', methods: ['database'] };
        } 
        else if (this.maleNames.has(lowerName)) {
            result = { gender: 'male', confidence: 0.98, method: 'database', methods: ['database'] };
        }
        // Method 2: Partial match
        else {
            for (let femaleName of this.femaleNames) {
                if (lowerName.includes(femaleName) || femaleName.includes(lowerName)) {
                    result = { gender: 'female', confidence: 0.85, method: 'partial', methods: ['partial_match'] };
                    break;
                }
            }
            
            if (result.gender === 'unknown') {
                for (let maleName of this.maleNames) {
                    if (lowerName.includes(maleName) || maleName.includes(lowerName)) {
                        result = { gender: 'male', confidence: 0.85, method: 'partial', methods: ['partial_match'] };
                        break;
                    }
                }
            }
        }
        
        // Method 3: Name ending analysis
        if (result.gender === 'unknown') {
            if (lowerName.endsWith('a') || lowerName.endsWith('i')) {
                result = { gender: 'female', confidence: 0.65, method: 'ending', methods: ['name_ending'] };
            } 
            else if (lowerName.endsWith('e') || lowerName.endsWith('o')) {
                result = { gender: 'male', confidence: 0.65, method: 'ending', methods: ['name_ending'] };
            }
        }
        
        // Method 4: Prefix analysis
        if (result.gender === 'unknown') {
            if (lowerName.startsWith('mwan') || lowerName.startsWith('binti')) {
                result = { gender: 'female', confidence: 0.90, method: 'prefix', methods: ['prefix'] };
            }
        }
        
        // Cache result
        this.cache.set(lowerName, result);
        
        // Auto-learn if confidence is high
        if (result.confidence > 0.8 && result.gender !== 'unknown') {
            this.addToLearning(lowerName, result.gender);
        }
        
        return result;
    }
    
    addToLearning(name, gender) {
        if (gender === 'female' && !this.femaleNames.has(name)) {
            this.femaleNames.add(name);
            this.saveNames();
            console.log(`📚 Learned new female name: ${name}`);
        } else if (gender === 'male' && !this.maleNames.has(name)) {
            this.maleNames.add(name);
            this.saveNames();
            console.log(`📚 Learned new male name: ${name}`);
        }
    }
    
    addFemaleName(name) {
        this.femaleNames.add(name.toLowerCase());
        this.saveNames();
        console.log(`✅ Added female name: ${name}`);
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
            // Sample female contacts
            femaleDevices = [
                {
                    deviceId: "FATMA-001",
                    deviceName: "Fatma's Phone",
                    phoneNumber: "+255712345678",
                    ownerName: "Fatma Hassan",
                    gender: "female",
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "AISHA-002",
                    deviceName: "Aisha's Phone",
                    phoneNumber: "+255765432109",
                    ownerName: "Aisha Juma",
                    gender: "female",
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "MARIAM-003",
                    deviceName: "Mariam's Phone",
                    phoneNumber: "+255756789012",
                    ownerName: "Mariam Salim",
                    gender: "female",
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
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

function findOrAddFemale(deviceId, deviceName, phoneNumber = null) {
    // Check if already in database
    let female = femaleDevices.find(d => 
        d.deviceId.toLowerCase() === deviceId.toLowerCase()
    );
    
    if (female) {
        female.lastSeen = new Date().toISOString();
        if (phoneNumber && phoneNumber !== 'PENDING' && female.phoneNumber === 'PENDING') {
            female.phoneNumber = phoneNumber;
        }
        saveDevices();
        return female;
    }
    
    // Try to detect by name
    if (deviceName && deviceName !== 'Unknown' && deviceName !== 'undefined') {
        const detection = detector.detectGender(deviceName);
        
        if (detection.gender === 'female' && detection.confidence > 0.6) {
            console.log(`🎯 Auto-detected female: ${deviceName} (${detection.method}, ${detection.confidence * 100}%)`);
            
            const newFemale = {
                deviceId: deviceId,
                deviceName: deviceName,
                phoneNumber: phoneNumber || 'PENDING',
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
        return res.status(400).json({ error: 'deviceId and phoneNumber are required' });
    }
    
    const existing = femaleDevices.find(d => d.deviceId === deviceId);
    
    if (existing) {
        existing.phoneNumber = phoneNumber;
        existing.ownerName = ownerName || existing.ownerName;
        existing.deviceName = deviceName || existing.deviceName;
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
    const removed = femaleDevices.find(d => d.deviceId === deviceId);
    femaleDevices = femaleDevices.filter(d => d.deviceId !== deviceId);
    saveDevices();
    res.json({ success: true, removed: removed || null });
});

app.get('/api/detect', (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: 'Name parameter required' });
    }
    const result = detector.detectGender(name);
    res.json(result);
});

app.post('/api/add-female-name', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    detector.addFemaleName(name);
    res.json({ success: true, message: `Added "${name}" to female names` });
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalFemalesTracked: femaleDevices.length,
        autoDetected: femaleDevices.filter(f => f.autoDetected).length,
        femaleNamesInDB: detector.femaleNames.size,
        maleNamesInDB: detector.maleNames.size,
        pendingPhoneNumbers: femaleDevices.filter(f => f.phoneNumber === 'PENDING').length
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        females_tracked: femaleDevices.length,
        detector_ready: true,
        timestamp: new Date().toISOString()
    });
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
    console.log('🟢 Client connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi, phoneNumber } = data;
        
        const dist = distance || 0;
        console.log(`📡 Device: ${deviceName || deviceId}, Distance: ${dist.toFixed(2)}m, RSSI: ${rssi || 0}dBm`);
        
        if (dist <= 10) {
            const female = findOrAddFemale(deviceId, deviceName, phoneNumber);
            
            if (female) {
                console.log(`✅ FEMALE DETECTED: ${female.ownerName} at ${dist.toFixed(2)}m`);
                
                const detection = {
                    deviceId: female.deviceId,
                    deviceName: female.deviceName,
                    phoneNumber: female.phoneNumber,
                    ownerName: female.ownerName,
                    distance: dist,
                    rssi: rssi,
                    confidence: female.confidence || 1.0,
                    timestamp: new Date().toISOString()
                };
                
                io.emit('female-detected', detection);
            } else {
                console.log(`⚠️ Not female: ${deviceName}`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance: dist,
                    message: 'Device not identified as female'
                });
            }
        } else {
            console.log(`📏 Device at ${dist.toFixed(2)}m - outside 10m range`);
        }
    });
    
    socket.on('send-sms', (data) => {
        console.log(`📱 SMS to ${data.phoneNumber}: ${data.message}`);
        io.emit('sms-result', { 
            success: true, 
            message: `SMS sent to ${data.phoneNumber}`,
            mock: true 
        });
    });
    
    socket.on('make-call', (data) => {
        console.log(`📞 Call to ${data.phoneNumber}`);
        io.emit('call-result', { 
            success: true, 
            message: `Call initiated to ${data.phoneNumber}`,
            mock: true 
        });
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

loadDevices();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('=' .repeat(50));
    console.log(`🚀 FEMALE PHONE TRACKER RUNNING`);
    console.log('=' .repeat(50));
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`👩 Females tracked: ${femaleDevices.length}`);
    console.log(`📚 Female names in DB: ${detector.femaleNames.size}`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔍 Test gender: http://0.0.0.0:${PORT}/api/detect?name=Fatma`);
    console.log('=' .repeat(50));
});
