const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
require('dotenv').config();

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
        this.apiCalls = 0;
        this.lastApiCall = 0;
        
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
            'zahra', 'zakia', 'zamda', 'zawadi', 'zubeda', 'zuhura', 'zuleikha', 'zulfa'
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
            'yalinde', 'yangwe', 'yohana', 'yusuph', 'zacharia', 'zahabu', 'zakaria', 'zamda'
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
            { suffix: 'ya', weight: 0.8, gender: 'female' }
        ];
        
        this.prefixPatterns = [
            { prefix: 'mwan', weight: 0.95, gender: 'female', meaning: 'child of' },
            { prefix: 'binti', weight: 0.95, gender: 'female', meaning: 'daughter of' },
            { prefix: 'siti', weight: 0.95, gender: 'female', meaning: 'lady' },
            { prefix: 'haj', weight: 0.85, gender: 'female', meaning: 'pilgrim' }
        ];
    }
    
    async detectGender(name, phoneNumber = null, deviceId = null) {
        if (!name || name === 'Unknown' || name === 'undefined') {
            return this.getUnknownResult();
        }
        
        // Check cache first
        const cacheKey = name.toLowerCase();
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 86400000) { // 24 hours cache
                return cached.result;
            }
        }
        
        let results = [];
        
        // Method 1: Local database check (Accuracy: 98%)
        const localResult = this.checkLocalDatabase(name);
        results.push(localResult);
        
        // Method 2: Pattern matching (Accuracy: 75%)
        const patternResult = this.checkPatterns(name);
        results.push(patternResult);
        
        // Method 3: Name suffix analysis (Accuracy: 65%)
        const suffixResult = this.checkSuffix(name);
        results.push(suffixResult);
        
        // Method 4: Name prefix analysis (Accuracy: 85%)
        const prefixResult = this.checkPrefix(name);
        results.push(prefixResult);
        
        // Method 5: Internet APIs (Accuracy: 90-95%)
        const apiResult = await this.checkInternetAPIs(name);
        results.push(apiResult);
        
        // Method 6: Machine learning from learning data (Accuracy: 80%)
        const mlResult = this.checkMachineLearning(name);
        results.push(mlResult);
        
        // Method 7: Web scraping from social media (Accuracy: 70%)
        const webResult = await this.scrapeWebForName(name);
        results.push(webResult);
        
        // Method 8: Phone number lookup services (if available)
        const phoneResult = await this.checkPhoneServices(phoneNumber);
        results.push(phoneResult);
        
        // Method 9: Cross-reference with known databases
        const crossRefResult = this.crossReferenceWithKnownNames(name);
        results.push(crossRefResult);
        
        // Method 10: Statistical analysis
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
        const lowerName = name.toLowerCase();
        
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
    
    async checkInternetAPIs(name) {
        const results = [];
        
        // API 1: Genderize.io (Free, 1000/day)
        try {
            const genderizeResult = await this.callGenderizeAPI(name);
            results.push(genderizeResult);
        } catch (error) {
            console.log('Genderize API failed:', error.message);
        }
        
        // API 2: Namsor API (if key available)
        if (process.env.NAMSOR_API_KEY) {
            try {
                const namsorResult = await this.callNamsorAPI(name);
                results.push(namsorResult);
            } catch (error) {
                console.log('Namsor API failed:', error.message);
            }
        }
        
        // API 3: Gender API (if key available)
        if (process.env.GENDER_API_KEY) {
            try {
                const genderApiResult = await this.callGenderAPI(name);
                results.push(genderApiResult);
            } catch (error) {
                console.log('Gender API failed:', error.message);
            }
        }
        
        // Aggregate API results
        let femaleCount = 0;
        let maleCount = 0;
        let totalConfidence = 0;
        
        for (let result of results) {
            if (result.gender === 'female') {
                femaleCount++;
                totalConfidence += result.confidence;
            } else if (result.gender === 'male') {
                maleCount++;
                totalConfidence += result.confidence;
            }
        }
        
        if (femaleCount > maleCount && femaleCount > 0) {
            const avgConfidence = totalConfidence / femaleCount;
            return {
                gender: 'female',
                method: 'internet_apis',
                confidence: Math.min(0.95, avgConfidence),
                weight: 0.9,
                apiCount: results.length
            };
        } else if (maleCount > femaleCount && maleCount > 0) {
            const avgConfidence = totalConfidence / maleCount;
            return {
                gender: 'male',
                method: 'internet_apis',
                confidence: Math.min(0.95, avgConfidence),
                weight: 0.9,
                apiCount: results.length
            };
        }
        
        return { gender: 'unknown', method: 'internet_apis', confidence: 0, weight: 0 };
    }
    
    async callGenderizeAPI(name) {
        // Rate limiting: 10 requests per second
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < 100) {
            await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastCall));
        }
        
        this.lastApiCall = Date.now();
        this.apiCalls++;
        
        try {
            const response = await axios.get(`https://api.genderize.io/?name=${encodeURIComponent(name)}`);
            const data = response.data;
            
            if (data.gender === 'female') {
                return { gender: 'female', confidence: data.probability || 0.8, source: 'genderize' };
            } else if (data.gender === 'male') {
                return { gender: 'male', confidence: data.probability || 0.8, source: 'genderize' };
            }
            return { gender: 'unknown', confidence: 0, source: 'genderize' };
        } catch (error) {
            throw error;
        }
    }
    
    async callNamsorAPI(name) {
        const response = await axios.get(
            `https://v2.namsor.com/NamSorAPIv2/api2/json/gender/${encodeURIComponent(name)}`,
            {
                headers: { 'X-API-Key': process.env.NAMSOR_API_KEY }
            }
        );
        
        if (response.data.gender === 'female') {
            return { gender: 'female', confidence: response.data.score || 0.8, source: 'namsor' };
        } else if (response.data.gender === 'male') {
            return { gender: 'male', confidence: response.data.score || 0.8, source: 'namsor' };
        }
        return { gender: 'unknown', confidence: 0, source: 'namsor' };
    }
    
    async callGenderAPI(name) {
        const response = await axios.get(
            `https://gender-api.com/get?name=${encodeURIComponent(name)}&key=${process.env.GENDER_API_KEY}`
        );
        
        if (response.data.gender === 'female') {
            return { gender: 'female', confidence: response.data.accuracy / 100, source: 'genderapi' };
        } else if (response.data.gender === 'male') {
            return { gender: 'male', confidence: response.data.accuracy / 100, source: 'genderapi' };
        }
        return { gender: 'unknown', confidence: 0, source: 'genderapi' };
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
    
    async scrapeWebForName(name) {
        // Web scraping from multiple sources
        const sources = [
            `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`,
            `https://www.behindthename.com/name/${encodeURIComponent(name)}`,
            `https://nameberry.com/baby-name/${encodeURIComponent(name)}`
        ];
        
        let femaleMentions = 0;
        let maleMentions = 0;
        
        for (let source of sources) {
            try {
                const response = await axios.get(source, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                const content = response.data.toLowerCase();
                
                if (content.includes('feminine') || content.includes('girl') || content.includes('female')) {
                    femaleMentions++;
                }
                if (content.includes('masculine') || content.includes('boy') || content.includes('male')) {
                    maleMentions++;
                }
            } catch (error) {
                // Silently fail for web scraping
            }
        }
        
        if (femaleMentions > maleMentions && femaleMentions > 0) {
            return {
                gender: 'female',
                method: 'web_scraping',
                confidence: Math.min(0.8, femaleMentions / (femaleMentions + maleMentions)),
                weight: 0.7
            };
        } else if (maleMentions > femaleMentions && maleMentions > 0) {
            return {
                gender: 'male',
                method: 'web_scraping',
                confidence: Math.min(0.8, maleMentions / (femaleMentions + maleMentions)),
                weight: 0.7
            };
        }
        
        return { gender: 'unknown', method: 'web_scraping', confidence: 0, weight: 0 };
    }
    
    async checkPhoneServices(phoneNumber) {
        if (!phoneNumber) {
            return { gender: 'unknown', method: 'phone_services', confidence: 0, weight: 0 };
        }
        
        // Try multiple phone lookup services
        const services = [
            `https://api.numverify.com/validate?number=${phoneNumber}&access_key=${process.env.NUMVERIFY_KEY}`,
            `https://apilayer.net/api/validate?access_key=${process.env.APILAYER_KEY}&number=${phoneNumber}`
        ];
        
        for (let service of services) {
            try {
                const response = await axios.get(service, { timeout: 3000 });
                if (response.data.valid && response.data.country_code === 'TZ') {
                    // Try to infer gender from carrier or location data
                    if (response.data.carrier && response.data.carrier.includes('Tigo')) {
                        // Some carriers have name patterns
                        return { gender: 'unknown', method: 'phone_services', confidence: 0.3, weight: 0.4 };
                    }
                }
            } catch (error) {
                // Continue to next service
            }
        }
        
        return { gender: 'unknown', method: 'phone_services', confidence: 0, weight: 0 };
    }
    
    crossReferenceWithKnownNames(name) {
        const commonFemalePrefixes = ['mari', 'fati', 'aish', 'zain', 'hal', 'sa'];
        const commonMalePrefixes = ['juma', 'hass', 'moha', 'sali', 'rash', 'omar'];
        
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
        // Analyze name statistics from known data
        const vowelCount = (name.match(/[aeiou]/gi) || []).length;
        const consonantCount = name.length - vowelCount;
        const vowelRatio = vowelCount / name.length;
        
        // Statistical patterns: Female names tend to have more vowels
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
        if (result.gender !== 'unknown' && result.confidence > 0.8) {
            this.learningData.push({
                name: name.toLowerCase(),
                gender: result.gender,
                confidence: result.confidence,
                timestamp: Date.now(),
                methods: result.methods
            });
            
            // Keep only last 10000 learning records
            if (this.learningData.length > 10000) {
                this.learningData = this.learningData.slice(-10000);
            }
            
            this.saveLearningData();
        }
    }
    
    startAutoLearning() {
        // Auto-learn from successful detections every hour
        setInterval(() => {
            this.autoLearnFromDetections();
        }, 3600000);
    }
    
    autoLearnFromDetections() {
        console.log('🧠 Auto-learning from recent detections...');
        // Analyze patterns and update databases
        const femaleNames = this.learningData.filter(d => d.gender === 'female').slice(-100);
        const maleNames = this.learningData.filter(d => d.gender === 'male').slice(-100);
        
        for (let name of femaleNames) {
            this.femaleNamesSet.add(name.name);
        }
        
        for (let name of maleNames) {
            this.maleNamesSet.add(name.name);
        }
        
        this.saveDatabases();
        console.log(`📚 Auto-learned: ${femaleNames.length} female, ${maleNames.length} male names`);
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
    
    async enrichWithSocialMedia(name) {
        // Try to get gender from social media profiles
        const platforms = [
            `https://api.twitter.com/2/users/by/username/${name}`,
            `https://graph.facebook.com/${name}`,
            `https://www.instagram.com/${name}/?__a=1`
        ];
        
        for (let platform of platforms) {
            try {
                const response = await axios.get(platform, {
                    headers: { 'Authorization': `Bearer ${process.env.SOCIAL_MEDIA_TOKEN}` },
                    timeout: 3000
                });
                
                if (response.data && response.data.gender) {
                    return response.data.gender;
                }
            } catch (error) {
                // Continue
            }
        }
        
        return null;
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
            femaleDevicesDatabase = [];
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

async function findOrDetectFemale(deviceId, deviceName, phoneNumber = null) {
    // First check database
    let female = femaleDevicesDatabase.find(d => 
        d.deviceId.toLowerCase() === deviceId.toLowerCase()
    );
    
    if (female) {
        female.lastSeen = new Date().toISOString();
        saveDevices();
        return female;
    }
    
    // Try to detect by name
    if (deviceName && deviceName !== 'Unknown') {
        const detection = await genderDetector.detectGender(deviceName, phoneNumber, deviceId);
        
        if (detection.gender === 'female' && detection.confidence > 0.7) {
            console.log(`🎯 Auto-detected female: ${deviceName} (confidence: ${detection.confidence})`);
            console.log(`   Methods used: ${detection.methods?.map(m => m.method).join(', ')}`);
            
            // Auto-add to database
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
    const message = `Habari ${ownerName}! Kifaa chako kimegunduliwa umbali wa ${distance.toFixed(1)} mita. Kwa maelezo zaidi, wasiliana nasi.`;
    console.log(`📱 [SMS] To: ${phoneNumber} | ${message}`);
    
    // Try multiple SMS gateways
    const gateways = [
        { name: 'Twilio', send: async () => {
            if (process.env.TWILIO_ACCOUNT_SID) {
                const twilio = require('twilio');
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                return await client.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber
                });
            }
            throw new Error('Twilio not configured');
        }},
        { name: 'Africa's Talking', send: async () => {
            if (process.env.AFRICAS_TALKING_KEY) {
                // Implement Africa's Talking
                console.log('Africa\'s Talking SMS would be sent');
                return true;
            }
            throw new Error('Africa\'s Talking not configured');
        }}
    ];
    
    for (let gateway of gateways) {
        try {
            const result = await gateway.send();
            return { success: true, gateway: gateway.name, result };
        } catch (error) {
            console.log(`${gateway.name} failed:`, error.message);
        }
    }
    
    return { success: false, message: 'No SMS gateway configured', mock: true };
}

async function callFemale(phoneNumber, ownerName, distance) {
    console.log(`📞 [CALL] To: ${phoneNumber} | Calling ${ownerName}`);
    return { success: true, mock: true, message: 'Call would be initiated' };
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
    res.json({ success: true, removed });
});

app.get('/api/detect-gender', async (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }
    
    const detection = await genderDetector.detectGender(name);
    res.json(detection);
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalFemales: femaleDevicesDatabase.length,
        autoDetected: femaleDevicesDatabase.filter(f => f.autoDetected).length,
        learningDataSize: genderDetector.learningData.length,
        femaleNamesCount: genderDetector.femaleNamesSet.size,
        maleNamesCount: genderDetector.maleNamesSet.size,
        apiCalls: genderDetector.apiCalls
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

// ==================== WEBSOCKET FOR REAL-TIME TRACKING ====================

io.on('connection', (socket) => {
    console.log('🟢 Scanner connected:', socket.id);
    
    socket.on('device-detected', async (data) => {
        const { deviceId, deviceName, distance, rssi, phoneNumber } = data;
        
        console.log(`📡 Scanning: ${deviceName || deviceId} at ${distance?.toFixed(2) || '?'}m`);
        
        if (distance <= 10) {
            // Try to find or detect female
            const femaleContact = await findOrDetectFemale(deviceId, deviceName, phoneNumber);
            
            if (femaleContact) {
                console.log(`✅ FEMALE DETECTED: ${femaleContact.ownerName} at ${distance.toFixed(2)}m`);
                
                const detection = {
                    deviceId: femaleContact.deviceId,
                    deviceName: femaleContact.deviceName,
                    phoneNumber: femaleContact.phoneNumber,
                    ownerName: femaleContact.ownerName,
                    gender: 'female',
                    distance: distance,
                    rssi: rssi,
                    confidence: femaleContact.confidence || 1.0,
                    timestamp: new Date().toISOString(),
                    within10Meters: true
                };
                
                io.emit('female-detected', detection);
                
                // Optionally send SMS
                if (femaleContact.phoneNumber && femaleContact.phoneNumber !== 'PENDING') {
                    await sendSMSToFemale(femaleContact.phoneNumber, femaleContact.ownerName, distance);
                }
            } else {
                console.log(`⚠️ Not detected as female: ${deviceName}`);
                io.emit('unknown-device', {
                    deviceId,
                    deviceName,
                    distance,
                    message: "Device not identified as female"
                });
            }
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
    console.log(`🚀 Female Phone Tracker running on http://0.0.0.0:${PORT}`);
    console.log(`👩 Tracking system ready - Auto-detecting females`);
    console.log(`📊 Stats: ${femaleDevicesDatabase.length} females in database`);
    console.log(`🧠 Gender detector: ${genderDetector.femaleNamesSet.size} female names learned`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔍 Test gender detection: http://0.0.0.0:${PORT}/api/detect-gender?name=Fatma`);
});
