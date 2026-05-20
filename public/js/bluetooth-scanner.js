// Bluetooth Scanner for proximity detection within 10 meters

class BluetoothProximityScanner {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.onDeviceFound = null;
        this.onDistanceUpdate = null;
        this.onError = null;
    }

    // Calculate distance based on RSSI (Received Signal Strength Indicator)
    // Formula: d = 10^((TxPower - RSSI) / (10 * n))
    // n = 2 for free space, TxPower = -59dBm at 1 meter
    calculateDistance(rssi) {
        const txPower = -59; // RSSI at 1 meter
        const n = 2; // Environment factor (2 = free space)
        
        if (rssi === 0) return -1;
        
        const ratio = (txPower - rssi) / (10 * n);
        const distance = Math.pow(10, ratio);
        
        // Cap at reasonable values
        if (distance > 50) return 50;
        if (distance < 0.5) return 0.5;
        
        return distance;
    }

    // Start scanning for nearby Bluetooth devices
    async startScanning() {
        if (!navigator.bluetooth) {
            this.triggerError('Web Bluetooth haitumiki kwenye browser yako. Tafadhali tumia Chrome au Edge.');
            return false;
        }

        this.isScanning = true;
        
        try {
            // Request device with specific services
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['generic_access', 'device_information']
            });

            if (!this.device) {
                this.triggerError('Hakuna kifaa kilichochaguliwa');
                return false;
            }

            // Connect to device
            this.server = await this.device.gatt.connect();
            
            // Get RSSI (signal strength) to calculate distance
            await this.getRSSI();
            
            // Setup disconnect handler
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Device disconnected');
                this.stopScanning();
            });

            return true;
            
        } catch (error) {
            console.error('Scan error:', error);
            this.triggerError(`Kosa: ${error.message}`);
            this.isScanning = false;
            return false;
        }
    }

    // Get RSSI value (requires Chrome with experimental features)
    async getRSSI() {
        if (this.device && this.device.watchAdvertisements) {
            await this.device.watchAdvertisements();
            
            this.device.addEventListener('advertisementreceived', (event) => {
                const rssi = event.rssi;
                const distance = this.calculateDistance(rssi);
                
                // Get device name
                const deviceName = this.device.name || 'Unknown Device';
                const deviceId = this.device.id;
                
                console.log(`Device: ${deviceName}, RSSI: ${rssi}dBm, Distance: ${distance.toFixed(2)}m`);
                
                if (this.onDistanceUpdate) {
                    this.onDistanceUpdate({
                        deviceId: deviceId,
                        deviceName: deviceName,
                        rssi: rssi,
                        distance: distance,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Check if within 10 meters
                if (distance <= 10 && this.onDeviceFound) {
                    this.onDeviceFound({
                        deviceId: deviceId,
                        deviceName: deviceName,
                        rssi: rssi,
                        distance: distance,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        } else {
            console.warn('RSSI watching not supported. Using simulation for demo.');
            this.simulateDistanceUpdates();
        }
    }

    // Simulate distance updates for demo (when real RSSI not available)
    simulateDistanceUpdates() {
        let distance = 15; // Start at 15 meters
        let decreasing = true;
        
        this.scanInterval = setInterval(() => {
            if (!this.isScanning) return;
            
            // Simulate movement
            if (decreasing) {
                distance -= 0.5;
                if (distance <= 2) decreasing = false;
            } else {
                distance += 0.5;
                if (distance >= 20) decreasing = true;
            }
            
            const rssi = -59 - 20 * Math.log10(distance);
            
            if (this.onDistanceUpdate) {
                this.onDistanceUpdate({
                    deviceId: this.device?.id || 'simulated-device',
                    deviceName: this.device?.name || 'Simulated Device',
                    rssi: Math.round(rssi),
                    distance: Math.round(distance * 10) / 10,
                    timestamp: new Date().toISOString(),
                    simulated: true
                });
            }
            
            if (distance <= 10 && this.onDeviceFound) {
                this.onDeviceFound({
                    deviceId: this.device?.id || 'simulated-device',
                    deviceName: this.device?.name || 'Simulated Device',
                    rssi: Math.round(rssi),
                    distance: Math.round(distance * 10) / 10,
                    timestamp: new Date().toISOString(),
                    simulated: true
                });
            }
        }, 2000);
    }

    // Stop scanning
    stopScanning() {
        this.isScanning = false;
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        
        this.device = null;
        this.server = null;
    }

    triggerError(message) {
        if (this.onError) {
            this.onError(message);
        }
    }
}

// Make available globally
window.BluetoothProximityScanner = BluetoothProximityScanner;
