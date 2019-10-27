const path = require("path");
const {tests} = require("@iobroker/testing");
const {Observable} = require("rxjs");

const device = {
    "@type": "device",
    "rootDeviceId": "xx-xx-xx-xx-xx-xx",
    "id": "hdm:HomeMaticIP:000000000",
    "deviceServiceIds": [
        "Thermostat",
        "BatteryLevel",
        "ValveTappet",
        "TemperatureLevel",
        "TemperatureOffset"
    ],
    "manufacturer": "BOSCH",
    "roomId": "hz_1",
    "deviceModel": "TRV",
    "serial": "000000000",
    "profile": "GENERIC",
    "name": "Thermostat",
    "status": "AVAILABLE",
    "parentDeviceId": "roomClimateControl_hz_1",
    "childDeviceIds": []
};

const deviceService = {
    "@type": "DeviceServiceData",
    "id": "RoomClimateControl",
    "deviceId": "roomClimateControl_hz_1",
    "state": {
        "@type": "climateControlState",
        "operationMode": "AUTOMATIC",
        "setpointTemperature": 5,
        "setpointTemperatureForLevelEco": 5,
        "setpointTemperatureForLevelComfort": 20,
        "schedule": {},
        "ventilationMode": false,
        "low": false,
        "boostMode": false,
        "summerMode": false,
        "supportsBoostMode": true,
        "showSetpointTemperature": false
    },
    "operations": [
        "incrementSetpointTemperature",
        "decrementSetpointTemperature"
    ],
    "path": "/devices/roomClimateControl_hz_1/services/RoomClimateControl"
};

const bshbMock = {
    BoschSmartHomeBridge: function() {
        return {
            pairIfNeeded: () => {
                return new Observable((observer) => {
                    observer.next({url: 'test', token: 'test'});
                    observer.complete();
                });
            },
            getBshcClient: () => {
                return {
                    getRooms: () => {
                        return new Observable((observer) => {
                            observer.next([{
                                "@type": "room",
                                "id": "hz_2",
                                "iconId": "icon_room_living_room",
                                "name": "Wohnzimmer"
                            }]);
                            observer.complete();
                        });
                    },
                    getDevices: () => {
                        return new Observable((observer) => {
                            observer.next([device]);
                            observer.complete();
                        });
                    },
                    getDevicesServices: () => {
                        return new Observable((observer) => {
                            observer.next([deviceService]);
                            observer.complete();
                        });
                    },
                    subscribe: (mac) =>  {
                        return new Observable((observer) => {
                            observer.next({
                                result: 'test'
                            });
                            observer.complete();
                        });
                    },
                    longPolling: (id) => {
                        return new Observable((observer) => {
                            observer.next({
                                result: [deviceService]
                            });
                            setTimeout(() => {
                                observer.complete();
                            }, 2000);
                        });
                    },
                    unsubscribe: (id) => {
                        return new Observable((observer) => {
                            observer.next();
                            observer.complete();
                        });
                    }
                }
            }
        }
    }
};

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, ".."), {
        startTimeout: 20000,
        additionalMockedModules: {
            "bosch-smart-home-bridge": bshbMock
        },
        overwriteAdapterConfig: (config) => {

            config.systemPassword = 'Test';
            config.identifier = 'Test';
            config.pairingDelay = 1000;
            config.host = '127.0.0.1';
            config.mac = 'xx-xx-xx-xx-xx';
            config.certsPath = '/test';


            return config;
        }
    }
);

