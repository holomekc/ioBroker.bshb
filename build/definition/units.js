"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNITS = void 0;
exports.UNITS = {
    temperatureLevelState: {
        temperature: '°C',
    },
    climateControlState: {
        setpointTemperature: '°C',
        setpointTemperatureForLevelEco: '°C',
        setpointTemperatureForLevelComfort: '°C',
    },
    colorTemperatureState: {
        colorTemperature: 'K',
    },
    multiLevelSwitchState: {
        level: '%',
    },
    temperatureOffsetState: {
        offset: '°C',
    },
    valveTappetState: {
        position: '%',
    },
    airQualityLevelState: {
        temperature: '°C',
        humidity: '%',
        purity: 'ppm',
    },
    intrusionDetectionControlState: {
        armActivationDelayTime: 's',
        alarmActivationDelayTime: 's',
        remainingTimeUntilArmed: 'ms',
    },
    ventilationDelayState: {
        delay: 's',
    },
    powerMeterState: {
        powerConsumption: 'W',
        energyConsumption: 'Wh',
    },
    powerSwitchState: {
        automaticPowerOffTime: 's',
    },
    roomExtProperties: {
        humidity: '%',
    },
    // instruction detection api data
    armingState: {
        remainingTimeUntilArmed: 'ms',
    },
};
//# sourceMappingURL=units.js.map
