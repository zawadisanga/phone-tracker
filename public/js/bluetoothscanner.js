class FemaleBluetoothScanner {
    constructor() {
        this.device = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.onFemaleDetected = null;
        this.onDistanceUpdate = null;
        this.onError = null;
    }

    calculateDistance(rssi) {
        const txPower = -59;
        const n = 2;
        if (rssi === 0) return -1;
        const ratio = (txPower - rssi) / (10 * n);
        const distance = Math.pow(10, ratio);
        if (distance > 50) return 50;
        if (distance < 0.5) return 0.5;
        return distance;
    }

    async startScanning() {
        if (!navigator.bluetooth) {
            this.triggerError('Web Bluetooth haitumiki. Tafadhali tumia Chrome au Edge.');
            return false;
        }

        this.isScanning = true;
        
        try {
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['generic_access']
            });

            if (!this.device) {
                this.triggerError('Hakuna kifaa kilichochaguliwa');
                return false;
            }

            await this.device.gatt.connect();
            
            if (this.device.watchAdvertisements) {
                await this.device.watchAdvertisements();
                
                this.device.addEventListener('advertisementreceived', (event) => {
                    const rssi = event.rssi;
                    const distance = this.calculateDistance(rssi);
                    const deviceId = this.device.id;
                    const deviceName = this.device.name || 'Unknown Device';
                    
                    if (this.onDistanceUpdate) {
                        this.onDistanceUpdate({ deviceId, deviceName, rssi, distance });
                    }
                    
                    if (distance <= 10 && this.onFemaleDetected) {
                        this.onFemaleDetected({ deviceId, deviceName, rssi, distance });
                    }
                });
            } else {
                this.simulateScanning();
            }
            
            return true;
        } catch (error) {
            this.triggerError(`Kosa: ${error.message}`);
            this.isScanning = false;
            return false;
        }
    }

    simulateScanning() {
        let distance = 15;
        let decreasing = true;
        
        this.scanInterval = setInterval(() => {
            if (!this.isScanning) return;
            
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
                    deviceId: this.device?.id || 'simulated',
                    deviceName: this.device?.name || 'Simulated Device',
                    rssi: Math.round(rssi),
                    distance: Math.round(distance * 10) / 10,
                    simulated: true
                });
            }
            
            if (distance <= 10 && this.onFemaleDetected) {
                this.onFemaleDetected({
                    deviceId: this.device?.id || 'FATMA-PHONE-001',
                    deviceName: this.device?.name || "Fatma's iPhone",
                    rssi: Math.round(rssi),
                    distance: Math.round(distance * 10) / 10,
                    simulated: true
                });
            }
        }, 2000);
    }

    stopScanning() {
        this.isScanning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        if (this.device && this.device.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.device = null;
    }

    triggerError(message) {
        if (this.onError) this.onError(message);
    }
}

window.FemaleBluetoothScanner = FemaleBluetoothScanner;
