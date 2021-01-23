"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNITS = void 0;
exports.UNITS = {
    temperatureLevelState: {
        temperature: '°C'
    },
    climateControlState: {
        setpointTemperature: '°C',
        setpointTemperatureForLevelEco: '°C',
        setpointTemperatureForLevelComfort: '°C'
    },
    colorTemperatureState: {
        colorTemperature: 'K'
    },
    multiLevelSwitchState: {
        level: '%'
    },
    temperatureOffsetState: {
        offset: '°C'
    },
    valveTappetState: {
        position: '%'
    },
    airQualityLevelState: {
        temperature: '°C',
        humidity: '%',
        purity: 'ppm'
    },
    intrusionDetectionControlState: {
        armActivationDelayTime: 's',
        alarmActivationDelayTime: 's'
    },
    ventilationDelayState: {
        delay: 's'
    },
    powerMeterState: {
        powerConsumption: 'W',
        energyConsumption: 'Wh'
    },
    powerSwitchState: {
        automaticPowerOffTime: 's'
    }
};
