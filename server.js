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
const LEARNING_DB_PATH = path.join(__dirname, 'data', 'learning_data.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// ==================== SUPER ADVANCED GENDER DETECTION SYSTEM ====================

class SuperGenderDetector {
    constructor() {
        this.femaleNamesSet = new Set();
        this.maleNamesSet = new Set();
        this.unknownNamesSet = new Set();
        this.namePatterns = [];
        this.suffixPatterns = [];
        this.prefixPatterns = [];
        this.learningData = [];
        this.cache = new Map();
        
        // Load databases
        this.loadLocalDatabases();
        
        // Initialize patterns
        this.initPatterns();
        
        // Start auto-learning
        this.startAutoLearning();
        
        console.log('🤖 Super Gender Detector Initialized');
    }
    
    loadLocalDatabases() {
        try {
            if (fs.existsSync(FEMALE_NAMES_DB_PATH)) {
                const data = JSON.parse(fs.readFileSync(FEMALE_NAMES_DB_PATH, 'utf8'));
                this.femaleNamesSet = new Set(data.femaleNames || []);
                this.maleNamesSet = new Set(data.maleNames || []);
                this.namePatterns = data.patterns || [];
                console.log(`📚 Loaded ${this.femaleNamesSet.size} female names, ${this.maleNamesSet.size} male names`);
            } else {
                // Initialize with Tanzanian names
                this.initializeTanzanianNames();
            }
            
            if (fs.existsSync(LEARNING_DB_PATH)) {
                this.learningData = JSON.parse(fs.readFileSync(LEARNING_DB_PATH, 'utf8'));
                console.log(`🧠 Loaded ${this.learningData.length} learning records`);
            }
        } catch (error) {
            console.error('Error loading databases:', error);
            this.initializeTanzanianNames();
        }
    }
    
    initializeTanzanianNames() {
        // Comprehensive Tanzanian female names
        const tanzanianFemaleNames = [
            'fatma', 'aisha', 'mariam', 'zainab', 'halima', 'saada', 'asha', 'mwanahamisi',
            'khadija', 'amina', 'rahma', 'nadia', 'sharifa', 'rehema', 'neema', 'upendo',
            'subira', 'saumu', 'mwanaidi', 'hawa', 'mwanaisha', 'aziza', 'samia', 'tatu',
            'pili', 'hodan', 'nasra', 'farida', 'zuhura', 'binti', 'mwana', 'safiya',
            'rukiya', 'saida', 'asia', 'biubwa', 'chausiku', 'dada', 'faraj', 'fatma',
            'hadija', 'hajra', 'hawaa', 'hidaya', 'husna', 'iltimas', 'imani', 'inaya',
            'jannat', 'kamilia', 'karima', 'kashifa', 'khatija', 'kulthum', 'lailat',
            'latifa', 'layla', 'lina', 'lulu', 'maimuna', 'malaika', 'maryam', 'mastura',
            'mawahib', 'mbaraka', 'mke', 'moyo', 'mpenzi', 'mwanajuma', 'mwanakhamis',
            'mwanakombo', 'mwanakweli', 'mwanamvita', 'mwananchi', 'mwanashamu', 'mwanaudi',
            'mwanayusuf', 'nabila', 'najma', 'nargis', 'nashra', 'nayla', 'noor', 'nura',
            'rahabi', 'rahma', 'rahmani', 'ramla', 'rana', 'rauda', 'raya', 'rayhana',
            'ridhwan', 'ruqayya', 'sabah', 'sabra', 'sadaf', 'safiya', 'sahla', 'sakina',
            'salama', 'salha', 'salma', 'samira', 'sanaa', 'sarah', 'sausan', 'sayyida',
            'selina', 'shadya', 'shahira', 'shakira', 'shamim', 'sharifa', 'shawana',
            'shukran', 'siti', 'sofia', 'subira', 'suhaila', 'sukaina', 'sumaiya', 'sunila',
            'suraya', 'tabia', 'tahira', 'talatu', 'tamima', 'tamira', 'tatu', 'thani',
            'thara', 'thawab', 'thuraya', 'tunu', 'upendo', 'warda', 'waridi', 'yasmin',
            'zahra', 'zakia', 'zamda', 'zawadi', 'zubeda', 'zuhura', 'zuleikha', 'zulfa',
            'mwanaidi', 'shani', 'tausi', 'dada', 'mama', 'bibi', 'nyanya', 'kaka'
        ];
        
        // Comprehensive Tanzanian male names
        const tanzanianMaleNames = [
            'juma', 'hassan', 'ali', 'mohamed', 'salim', 'hamza', 'idd', 'rashid', 'omar',
            'saidi', 'bakari', 'ramadhan', 'kassim', 'khamis', 'ibrahim', 'yusuf', 'islam',
            'abdallah', 'samwel', 'emanuel', 'john', 'peter', 'james', 'david', 'george',
            'william', 'charles', 'paul', 'mark', 'steven', 'andrew', 'joseph', 'thomas',
            'christopher', 'daniel', 'matthew', 'anthony', 'donald', 'jeffrey', 'kenneth',
            'lawrence', 'michael', 'patrick', 'richard', 'robert', 'ronald', 'timothy',
            'ahmed', 'amir', 'anwar', 'asad', 'ashraf', 'aziz', 'bashir', 'dawud', 'fahad',
            'farid', 'faris', 'fazal', 'gulam', 'habib', 'hakim', 'hamisi', 'harith',
            'haruna', 'hashim', 'hatibu', 'husein', 'ismail', 'jabir', 'jafari', 'jalal',
            'jamal', 'juma', 'kassim', 'khalid', 'khamis', 'khatib', 'ladha', 'luti',
            'maalim', 'mabruk', 'madin', 'mahmoud', 'makame', 'mansour', 'masoud', 'mbwana',
            'mfaume', 'mgeni', 'mhina', 'mjahed', 'mkalama', 'mkubwa', 'mkuu', 'mnazi',
            'mohamed', 'mosses', 'mourad', 'msafiri', 'mshale', 'mshenga', 'msonge', 'mtoro',
            'mtumwa', 'muhidin', 'muhsin', 'mukhtar', 'mumo', 'mungu', 'munir', 'muriithi',
            'musa', 'mustafa', 'muti', 'mutta', 'mwadini', 'mwaituka', 'mwana', 'mwanakweli',
            'mwananchi', 'mwangata', 'mwanyambi', 'mwarabu', 'mweusi', 'mwinyi', 'nassir',
            'nur', 'nuru', 'nyange', 'nyerere', 'osman', 'pili', 'ramadhani', 'ramazani',
            'rashidi', 'saad', 'sabri', 'saeed', 'saidi', 'sakina', 'salama', 'salim',
            'samboja', 'samson', 'santos', 'seif', 'selah', 'shabani', 'shafii', 'shah',
            'shariff', 'sheha', 'shekhan', 'shems', 'shemy', 'shewa', 'sibomana', 'sijaona',
            'simai', 'simo', 'sudi', 'suleiman', 'sultan', 'sumaili', 'swebe', 'tumaini',
            'tumbo', 'twaha', 'twalib', 'ubwa', 'urambo', 'waidi', 'wali', 'yahya', 'yakob',
            'yalinde', 'yangwe', 'yohana', 'yusuph', 'zacharia', 'zahabu', 'zakaria', 'zamda',
            'baba', 'mzee', 'kaka', 'ndugu', 'rafiki', 'jirani'
        ];
        
        this.femaleNamesSet = new Set(tanzanianFemaleNames);
        this.maleNamesSet = new Set(tanzanianMaleNames);
        this.saveDatabases();
    }
    
    initPatterns() {
        this.suffixPatterns = [
            { suffix: 'a', weight: 0.7, gender: 'female' },
            { suffix: 'i', weight: 0.6, gender: 'female' },
            { suffix: 'e', weight: 0.6, gender: 'male' },
            { suffix: 'o', weight: 0.7, gender: 'male' },
            { suffix: 'na', weight: 0.8, gender: 'female' },
            { suffix: 'ma', weight: 0.7, gender: 'female' },
            { suffix: 'tu', weight: 0.6, gender: 'female' },
            { suffix: 'zi', weight: 0.6, gender: 'female' },
            { suffix: 'li', weight: 0.7, gender: 'male' },
            { suffix: 'di', weight: 0.7, gender: 'male' },
            { suffix: 'ni', weight: 0.6, gender: 'female' },
            { suffix: 'ra', weight: 0.8, gender: 'female' },
            { suffix: 'ya', weight: 0.8, gender: 'female' },
            { suffix: 'sa', weight: 0.6, gender: 'female' },
            { suffix: 'za', weight: 0.6, gender: 'female' },
            { suffix: 'ta', weight: 0.5, gender: 'female' },
            { suffix: 'ka', weight: 0.5, gender: 'male' },
            { suffix: 'zi', weight: 0.6, gender: 'female' }
        ];
        
        this.prefixPatterns = [
            { prefix: 'mwan', weight: 0.95, gender: 'female', meaning: 'child of' },
            { prefix: 'binti', weight: 0.95, gender: 'female', meaning: 'daughter of' },
            { prefix: 'siti', weight: 0.95, gender: 'female', meaning: 'lady' },
            { prefix: 'haj', weight: 0.85, gender: 'female', meaning: 'pilgrim' },
            { prefix: 'mama', weight: 0.98, gender: 'female', meaning: 'mother' },
            { prefix: 'bibi', weight: 0.98, gender: 'female', meaning: 'grandmother' },
            { prefix: 'dada', weight: 0.95, gender: 'female', meaning: 'sister' },
            { prefix: 'mke', weight: 0.95, gender: 'female', meaning: 'wife' }
        ];
        
        this.namePatterns = [
            { text: 'fatma', weight: 0.98, gender: 'female' },
            { text: 'aisha', weight: 0.98, gender: 'female' },
            { text: 'mariam', weight: 0.98, gender: 'female' },
            { text: 'zainab', weight: 0.98, gender: 'female' },
            { text: 'halima', weight: 0.97, gender: 'female' },
            { text: 'juma', weight: 0.98, gender: 'male' },
            { text: 'hassan', weight: 0.98, gender: 'male' },
            { text: 'ali', weight: 0.98, gender: 'male' },
            { text: 'mohamed', weight: 0.98, gender: 'male' }
        ];
    }
    
    detectGender(name, phoneNumber = null, deviceId = null) {
        if (!name || name === 'Unknown' || name === 'undefined' || name === 'null') {
            return this.getUnknownResult();
        }
        
        // Check cache first
        const cacheKey = name.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 86400000) {
                return cached.result;
            }
        }
        
        let results = [];
        
        // Method 1: Local database check
        const localResult = this.checkLocalDatabase(name);
        results.push(localResult);
        
        // Method 2: Pattern matching
        const patternResult = this.checkPatterns(name);
        results.push(patternResult);
        
        // Method 3: Name suffix analysis
        const suffixResult = this.checkSuffix(name);
        results.push(suffixResult);
        
        // Method 4: Name prefix analysis
        const prefixResult = this.checkPrefix(name);
        results.push(prefixResult);
        
        // Method 5: Machine learning from learning data
        const mlResult = this.checkMachineLearning(name);
        results.push(mlResult);
        
        // Method 6: Cross-reference with known names
        const crossRefResult = this.crossReferenceWithKnownNames(name);
        results.push(crossRefResult);
        
        // Method 7: Statistical analysis
        const statsResult = this.statisticalAnalysis(name);
        results.push(statsResult);
        
        // Aggregate results with weights
        const finalResult = this.aggregateResults(results);
        
        // Cache the result
        this.cache.set(cacheKey, {
            result: finalResult,
            timestamp: Date.now()
        });
        
        // Save for learning
        this.saveForLearning(name, finalResult);
        
        return finalResult;
    }
    
    checkLocalDatabase(name) {
        const lowerName = name.toLowerCase().trim();
        
        if (this.femaleNamesSet.has(lowerName)) {
            return { gender: 'female', method: 'local_db', confidence: 0.98, weight: 1.0 };
        }
        if (this.maleNamesSet.has(lowerName)) {
            return { gender: 'male', method: 'local_db', confidence: 0.98, weight: 1.0 };
        }
        
        // Check for partial matches
        for (let femaleName of this.femaleNamesSet) {
            if (lowerName.includes(femaleName) || femaleName.includes(lowerName)) {
                return { gender: 'female', method: 'local_db_partial', confidence: 0.85, weight: 0.9 };
            }
        }
        
        for (let maleName of this.maleNamesSet) {
            if (lowerName.includes(maleName) || maleName.includes(lowerName)) {
                return { gender: 'male', method: 'local_db_partial', confidence: 0.85, weight: 0.9 };
            }
        }
        
        return { gender: 'unknown', method: 'local_db', confidence: 0, weight: 0 };
    }
    
    checkPatterns(name) {
        const lowerName = name.toLowerCase();
        let femaleScore = 0;
        let maleScore = 0;
        
        for (let pattern of this.namePatterns) {
            if (lowerName.includes(pattern.text)) {
                if (pattern.gender === 'female') femaleScore += pattern.weight;
                else maleScore += pattern.weight;
            }
        }
        
        if (femaleScore > maleScore && femaleScore > 0.5) {
            return { gender: 'female', method: 'pattern_match', confidence: Math.min(0.9, femaleScore), weight: 0.85 };
        } else if (maleScore > femaleScore && maleScore > 0.5) {
            return { gender: 'male', method: 'pattern_match', confidence: Math.min(0.9, maleScore), weight: 0.85 };
        }
        
        return { gender: 'unknown', method: 'pattern_match', confidence: 0, weight: 0 };
    }
    
    checkSuffix(name) {
        const lowerName = name.toLowerCase();
        let bestMatch = { gender: 'unknown', confidence: 0 };
        
        for (let pattern of this.suffixPatterns) {
            if (lowerName.endsWith(pattern.suffix)) {
                if (pattern.weight > bestMatch.confidence) {
                    bestMatch = {
                        gender: pattern.gender,
                        confidence: pattern.weight,
                        suffix: pattern.suffix
                    };
                }
            }
        }
        
        if (bestMatch.confidence > 0) {
            return {
                gender: bestMatch.gender,
                method: 'suffix_analysis',
                confidence: bestMatch.confidence,
                weight: 0.7,
                details: `ends with '${bestMatch.suffix}'`
            };
        }
        
        return { gender: 'unknown', method: 'suffix_analysis', confidence: 0, weight: 0 };
    }
    
    checkPrefix(name) {
        const lowerName = name.toLowerCase();
        let bestMatch = { gender: 'unknown', confidence: 0 };
        
        for (let pattern of this.prefixPatterns) {
            if (lowerName.startsWith(pattern.prefix)) {
                if (pattern.weight > bestMatch.confidence) {
                    bestMatch = {
                        gender: pattern.gender,
                        confidence: pattern.weight,
                        prefix: pattern.prefix,
                        meaning: pattern.meaning
                    };
                }
            }
        }
        
        if (bestMatch.confidence > 0) {
            return {
                gender: bestMatch.gender,
                method: 'prefix_analysis',
                confidence: bestMatch.confidence,
                weight: 0.85,
                details: `starts with '${bestMatch.prefix}' (${bestMatch.meaning})`
            };
        }
        
        return { gender: 'unknown', method: 'prefix_analysis', confidence: 0, weight: 0 };
    }
    
    checkMachineLearning(name) {
        if (this.learningData.length === 0) {
            return { gender: 'unknown', method: 'machine_learning', confidence: 0, weight: 0 };
        }
        
        const lowerName = name.toLowerCase();
        let similarNames = [];
        
        for (let record of this.learningData) {
            if (record.name && record.name.toLowerCase().includes(lowerName)) {
                similarNames.push(record);
            }
        }
        
        if (similarNames.length > 0) {
            let femaleCount = similarNames.filter(n => n.gender === 'female').length;
            let maleCount = similarNames.filter(n => n.gender === 'male').length;
            
            if (femaleCount > maleCount) {
                return {
                    gender: 'female',
                    method: 'machine_learning',
                    confidence: Math.min(0.9, femaleCount / similarNames.length),
                    weight: 0.85,
                    samples: similarNames.length
                };
            } else if (maleCount > femaleCount) {
                return {
                    gender: 'male',
                    method: 'machine_learning',
                    confidence: Math.min(0.9, maleCount / similarNames.length),
                    weight: 0.85,
                    samples: similarNames.length
                };
            }
        }
        
        return { gender: 'unknown', method: 'machine_learning', confidence: 0, weight: 0 };
    }
    
    crossReferenceWithKnownNames(name) {
        const commonFemalePrefixes = ['mari', 'fati', 'aish', 'zain', 'hal', 'sa', 'rahm', 'nadi', 'shar', 'reh', 'neem', 'upend'];
        const commonMalePrefixes = ['juma', 'hass', 'moha', 'sali', 'rash', 'omar', 'said', 'bak', 'rama', 'kass', 'kham', 'ibra'];
        
        const lowerName = name.toLowerCase();
        let femaleScore = 0;
        let maleScore = 0;
        
        for (let prefix of commonFemalePrefixes) {
            if (lowerName.startsWith(prefix)) femaleScore += 0.3;
            if (lowerName.includes(prefix)) femaleScore += 0.2;
        }
        
        for (let prefix of commonMalePrefixes) {
            if (lowerName.startsWith(prefix)) maleScore += 0.3;
            if (lowerName.includes(prefix)) maleScore += 0.2;
        }
        
        if (femaleScore > maleScore && femaleScore > 0.5) {
            return { gender: 'female', method: 'cross_reference', confidence: Math.min(0.85, femaleScore), weight: 0.75 };
        } else if (maleScore > femaleScore && maleScore > 0.5) {
            return { gender: 'male', method: 'cross_reference', confidence: Math.min(0.85, maleScore), weight: 0.75 };
        }
        
        return { gender: 'unknown', method: 'cross_reference', confidence: 0, weight: 0 };
    }
    
    statisticalAnalysis(name) {
        const vowelCount = (name.match(/[aeiou]/gi) || []).length;
        const vowelRatio = vowelCount / name.length;
        
        if (vowelRatio > 0.5 && name.length > 3) {
            return { gender: 'female', method: 'statistical', confidence: 0.55, weight: 0.6 };
        } else if (vowelRatio < 0.3 && name.length > 3) {
            return { gender: 'male', method: 'statistical', confidence: 0.55, weight: 0.6 };
        }
        
        return { gender: 'unknown', method: 'statistical', confidence: 0, weight: 0 };
    }
    
    aggregateResults(results) {
        let femaleWeightSum = 0;
        let maleWeightSum = 0;
        let totalWeight = 0;
        let methods = [];
        
        for (let result of results) {
            if (result.gender === 'female') {
                femaleWeightSum += result.confidence * result.weight;
                totalWeight += result.weight;
                methods.push({ method: result.method, confidence: result.confidence });
            } else if (result.gender === 'male') {
                maleWeightSum += result.confidence * result.weight;
                totalWeight += result.weight;
                methods.push({ method: result.method, confidence: result.confidence });
            }
        }
        
        if (totalWeight === 0) {
            return this.getUnknownResult();
        }
        
        const femaleScore = femaleWeightSum / totalWeight;
        const maleScore = maleWeightSum / totalWeight;
        
        if (femaleScore > maleScore && femaleScore > 0.6) {
            return {
                gender: 'female',
                confidence: femaleScore,
                methods: methods,
                finalScore: femaleScore
            };
        } else if (maleScore > femaleScore && maleScore > 0.6) {
            return {
                gender: 'male',
                confidence: maleScore,
                methods: methods,
                finalScore: maleScore
            };
        }
        
        return this.getUnknownResult();
    }
    
    getUnknownResult() {
        return {
            gender: 'unknown',
            confidence: 0,
            methods: [],
            finalScore: 0
        };
    }
    
    saveForLearning(name, result) {
        if (result.gender !== 'unknown' && result.confidence > 0.7) {
            this.learningData.push({
                name: name.toLowerCase(),
                gender: result.gender,
                confidence: result.confidence,
                timestamp: Date.now(),
                methods: result.methods
            });
            
            if (this.learningData.length > 10000) {
                this.learningData = this.learningData.slice(-10000);
            }
            
            this.saveLearningData();
            
            // Auto-add to names set
            if (result.gender === 'female') {
                this.femaleNamesSet.add(name.toLowerCase());
            } else if (result.gender === 'male') {
                this.maleNamesSet.add(name.toLowerCase());
            }
            this.saveDatabases();
        }
    }
    
    startAutoLearning() {
        setInterval(() => {
            this.autoLearnFromDetections();
        }, 3600000);
    }
    
    autoLearnFromDetections() {
        console.log('🧠 Auto-learning from recent detections...');
        const recentData = this.learningData.slice(-100);
        
        for (let record of recentData) {
            if (record.gender === 'female') {
                this.femaleNamesSet.add(record.name);
            } else if (record.gender === 'male') {
                this.maleNamesSet.add(record.name);
            }
        }
        
        this.saveDatabases();
        console.log(`📚 Auto-learned: ${this.femaleNamesSet.size} female, ${this.maleNamesSet.size} male names`);
    }
    
    saveDatabases() {
        const femaleNamesData = {
            femaleNames: Array.from(this.femaleNamesSet),
            maleNames: Array.from(this.maleNamesSet),
            patterns: this.namePatterns,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(FEMALE_NAMES_DB_PATH, JSON.stringify(femaleNamesData, null, 2));
    }
    
    saveLearningData() {
        fs.writeFileSync(LEARNING_DB_PATH, JSON.stringify(this.learningData, null, 2));
    }
    
    addFemaleName(name) {
        this.femaleNamesSet.add(name.toLowerCase());
        this.saveDatabases();
        console.log(`✅ Added female name: ${name}`);
    }
    
    addMaleName(name) {
        this.maleNamesSet.add(name.toLowerCase());
        this.saveDatabases();
        console.log(`✅ Added male name: ${name}`);
    }
    
    getStats() {
        return {
            femaleNames: this.femaleNamesSet.size,
            maleNames: this.maleNamesSet.size,
            learningData: this.learningData.length,
            cacheSize: this.cache.size
        };
    }
}

// Initialize the super gender detector
const genderDetector = new SuperGenderDetector();

// ==================== DATABASE MANAGEMENT ====================

let femaleDevicesDatabase = [];

function loadDevices() {
    try {
        if (fs.existsSync(DEVICES_DB_PATH)) {
            const data = fs.readFileSync(DEVICES_DB_PATH, 'utf8');
            femaleDevicesDatabase = JSON.parse(data);
            console.log(`✅ Loaded ${femaleDevicesDatabase.length} female contacts`);
        } else {
            femaleDevicesDatabase = [
                {
                    deviceId: "FATMA-PHONE-001",
                    deviceName: "Fatma's iPhone",
                    phoneNumber: "+255712345678",
                    ownerName: "Fatma Hassan",
                    gender: "female",
                    confidence: 0.98,
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "AISHA-SAMSUNG-002",
                    deviceName: "Aisha's Samsung",
                    phoneNumber: "+255765432109",
                    ownerName: "Aisha Juma",
                    gender: "female",
                    confidence: 0.98,
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "MARIAM-HUAWEI-003",
                    deviceName: "Mariam's Phone",
                    phoneNumber: "+255756789012",
                    ownerName: "Mariam Salim",
                    gender: "female",
                    confidence: 0.98,
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "ZAINAB-TECNO-004",
                    deviceName: "Zainab's Tecno",
                    phoneNumber: "+255767890123",
                    ownerName: "Zainab Mohamed",
                    gender: "female",
                    confidence: 0.98,
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
                },
                {
                    deviceId: "HALIMA-INFINIX-005",
                    deviceName: "Halima's Infinix",
                    phoneNumber: "+255754321987",
                    ownerName: "Halima Said",
                    gender: "female",
                    confidence: 0.98,
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString()
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

function findOrDetectFemale(deviceId, deviceName, phoneNumber = null) {
    let female = femaleDevicesDatabase.find(d => 
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
    
    if (deviceName && deviceName !== 'Unknown' && deviceName !== 'undefined' && deviceName !== 'null') {
        const detection = genderDetector.detectGender(deviceName, phoneNumber, deviceId);
        
        if (detection.gender === 'female' && detection.confidence > 0.6) {
            console.log(`🎯 Auto-detected female: ${deviceName} (confidence: ${(detection.confidence * 100).toFixed(1)}%)`);
            console.log(`   Methods used: ${detection.methods?.map(m => m.method).join(', ') || 'multiple'}`);
            
            const newFemale = {
                deviceId: deviceId,
                deviceName: deviceName,
                phoneNumber: phoneNumber || 'PENDING',
                ownerName: deviceName,
                gender: 'female',
                confidence: detection.confidence,
                detectionMethods: detection.methods,
                autoDetected: true,
                registeredAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
            
            femaleDevicesDatabase.push(newFemale);
            saveDevices();
            return newFemale;
        }
    }
    
    return null;
}

// ==================== COMMUNICATION FUNCTIONS ====================

async function sendSMSToFemale(phoneNumber, ownerName, distance) {
    const message = `Habari ${ownerName}! Kifaa chako kimegunduliwa umbali wa ${distance.toFixed(1)} mita.`;
    console.log(`📱 [SMS DEMO] To: ${phoneNumber} | ${message}`);
    
    return { 
        success: true, 
        mock: true, 
        message: `SMS would be sent to ${phoneNumber}`,
        details: `Habari ${ownerName}, uko karibu ${distance.toFixed(1)}m`
    };
}

async function callFemale(phoneNumber, ownerName, distance) {
    console.log(`📞 [CALL DEMO] To: ${phoneNumber} | Calling ${ownerName}`);
    return { 
        success: true, 
        mock: true, 
        message: `Call would be initiated to ${phoneNumber}`,
        details: `Calling ${ownerName}`
    };
}

// ==================== EXPRESS ROUTES ====================

app.get('/api/females', (req, res) => {
    res.json({ 
        success: true, 
        count: femaleDevicesDatabase.length,
        females: femaleDevicesDatabase 
    });
});

app.post('/api/females', async (req, res) => {
    const { deviceId, deviceName, phoneNumber, ownerName } = req.body;
    
    if (!deviceId || !phoneNumber) {
        return res.status(400).json({ error: 'deviceId and phoneNumber required' });
    }
    
    const existing = femaleDevicesDatabase.find(d => d.deviceId === deviceId);
    
    if (existing) {
        existing.phoneNumber = phoneNumber;
        existing.ownerName = ownerName || existing.ownerName;
        existing.deviceName = deviceName || existing.deviceName;
        existing.lastSeen = new Date().toISOString();
        saveDevices();
        res.json({ success: true, message: 'Female contact updated', contact: existing });
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
        femaleDevicesDatabase.push(newFemale);
        saveDevices();
        res.json({ success: true, message: 'Female contact added', contact: newFemale });
    }
});

app.delete('/api/females/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const removed = femaleDevicesDatabase.find(d => d.deviceId === deviceId);
    femaleDevicesDatabase = femaleDevicesDatabase.filter(d => d.deviceId !== deviceId);
    saveDevices();
    res.json({ success: true, removed: removed || null });
});

app.get('/api/detect-gender', (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    const detection = genderDetector.detectGender(name);
    res.json(detection);
});

app.post('/api/add-female-name', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    genderDetector.addFemaleName(name);
    res.json({ success: true, message: `Added "${name}" to female names` });
});

app.post('/api/add-male-name', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    genderDetector.addMaleName(name);
    res.json({ success: true, message: `Added "${name}" to male names` });
});

app.get('/api/stats', (req, res) => {
    const detectorStats = genderDetector.getStats();
    res.json({
        totalFemalesTracked: femaleDevicesDatabase.length,
        autoDetected: femaleDevicesDatabase.filter(f => f.autoDetected).length,
        pendingPhoneNumbers: femaleDevicesDatabase.filter(f => f.phoneNumber === 'PENDING').length,
        femaleNamesInDB: detectorStats.femaleNames,
        maleNamesInDB: detectorStats.maleNames,
        learningRecords: detectorStats.learningData,
        cacheSize: detectorStats.cacheSize
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        females_tracked: femaleDevicesDatabase.length,
        detector_ready: true,
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/names/female', (req, res) => {
    res.json({ 
        success: true, 
        count: genderDetector.femaleNamesSet.size,
        names: Array.from(genderDetector.femaleNamesSet).slice(0, 100)
    });
});

app.get('/api/names/male', (req, res) => {
    res.json({ 
        success: true, 
        count: genderDetector.maleNamesSet.size,
        names: Array.from(genderDetector.maleNamesSet).slice(0, 100)
    });
});

// ==================== WEBSOCKET FOR REAL-TIME TRACKING ====================

io.on('connection', (socket) => {
    console.log('🟢 Scanner connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi, phoneNumber } = data;
        const dist = distance || 0;
        
        console.log(`📡 Scanning: ${deviceName || deviceId} at ${dist.toFixed(2)}m, RSSI: ${rssi || 0}dBm`);
        
        if (dist <= 10) {
            const femaleContact = findOrDetectFemale(deviceId, deviceName, phoneNumber);
            
            if (femaleContact) {
                console.log(`✅ FEMALE DETECTED: ${femaleContact.ownerName} at ${dist.toFixed(2)}m`);
                
                const detection = {
                    deviceId: femaleContact.deviceId,
                    deviceName: femaleContact.deviceName,
                    phoneNumber: femaleContact.phoneNumber,
                    ownerName: femaleContact.ownerName,
                    gender: 'female',
                    distance: dist,
                    rssi: rssi,
                    confidence: femaleContact.confidence || 1.0,
                    timestamp: new Date().toISOString(),
                    within10Meters: true
                };
                
                io.emit('female-detected', detection);
                
                if (femaleContact.phoneNumber && femaleContact.phoneNumber !== 'PENDING') {
                    await sendSMSToFemale(femaleContact.phoneNumber, femaleContact.ownerName, dist);
                }
            } else {
                console.log(`⚠️ Not detected as female: ${deviceName}`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance: dist,
                    message: "Device not identified as female"
                });
            }
        } else {
            console.log(`📏 Device at ${dist.toFixed(2)}m - outside 10m range`);
        }
    });
    
    socket.on('send-sms-to-female', async (data) => {
        const result = await sendSMSToFemale(data.phoneNumber, data.ownerName, data.distance || 5);
        socket.emit('sms-result', result);
    });
    
    socket.on('call-female', async (data) => {
        const result = await callFemale(data.phoneNumber, data.ownerName, data.distance || 5);
        socket.emit('call-result', result);
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 Scanner disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

loadDevices();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 SUPER FEMALE PHONE TRACKER v2.0 RUNNING');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`👩 Females tracked: ${femaleDevicesDatabase.length}`);
    console.log(`📚 Female names in DB: ${genderDetector.femaleNamesSet.size}`);
    console.log(`📚 Male names in DB: ${genderDetector.maleNamesSet.size}`);
    console.log(`🧠 Learning records: ${genderDetector.learningData.length}`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔍 Test gender: http://0.0.0.0:${PORT}/api/detect-gender?name=Fatma`);
    console.log(`📊 Stats: http://0.0.0.0:${PORT}/api/stats`);
    console.log('='.repeat(60));
});
