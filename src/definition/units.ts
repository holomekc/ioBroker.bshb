export const UNITS: { [TypeName: string]: { [KeyName: string]: string } } = {
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
}