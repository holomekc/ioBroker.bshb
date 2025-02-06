"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLES = void 0;
exports.ROLES = {
    binarySwitchState: {
        on: 'switch',
    },
    temperatureLevelState: {
        temperature: 'value.temperature',
    },
    colorState: {
        rgb: 'level.color.rgb',
    },
    climateControlState: {
        setpointTemperature: 'level.temperature',
        setpointTemperatureForLevelEco: 'level.temperature',
        setpointTemperatureForLevelComfort: 'level.temperature',
        low: 'indicator',
        boostMode: 'switch.boost',
        operationMode: 'text',
        showSetpointTemperature: 'switch',
        summerMode: 'switch',
        supportsBoostMode: 'indicator',
        ventilationMode: 'indicator',
    },
    colorTemperatureState: {
        colorTemperature: 'level.color.temperature',
    },
    multiLevelSwitchState: {
        level: 'level.dimmer',
    },
    temperatureOffsetState: {
        offset: 'level',
        stepSize: 'level',
        minOffset: 'level',
        maxOffset: 'level',
    },
    childLockState: {
        childLock: 'text',
    },
    valveTappetState: {
        position: 'level.valve',
        value: 'text',
    },
    shutterContactState: {
        value: 'text',
    },
    // Twinguard
    smokeSensitivityState: {
        smokeSensitivity: 'text',
        preAlarmEnabled: 'indicator',
    },
    twinguardNightlyPromiseState: {
        nightlyPromiseEnabled: 'indicator',
    },
    communicationQualityState: {
        quality: 'text',
    },
    airQualityLevelState: {
        combinedRating: 'text',
        description: 'text',
        temperature: 'value.temperature',
        temperatureRating: 'text',
        humidity: 'value.humidity',
        humidityRating: 'text',
        purity: 'value',
        purityRating: 'text',
    },
    smokeDetectorCheckState: {
        value: 'text',
    },
    surveillanceAlarmState: {
        value: 'text',
        incidents: 'list',
    },
    intrusionDetectionControlState: {
        value: 'text',
        triggers: 'list',
        actuators: 'list',
        armActivationDelayTime: 'level',
        alarmActivationDelayTime: 'level',
        remainingTimeUntilArmed: 'value',
    },
    hueBridgeSearcherState: {
        searcherState: 'text',
        value: 'text',
    },
    armDisarmPushNotificationState: {
        state: 'text',
    },
    remoteAccessState: {
        state: 'text',
    },
    remotePushNotificationState: {
        state: 'text',
    },
    softwareUpdateState: {
        swUpdateState: 'text',
        swUpdateLastResult: 'text',
        swUpdateAvailableVersion: 'text',
        swInstalledVersion: 'text',
    },
    ventilationDelayState: {
        devices: 'list',
        delay: 'level',
    },
    powerMeterState: {
        powerConsumption: 'value.power.consumption',
        energyConsumption: 'value.power.consumption',
    },
    powerSwitchState: {
        switchState: 'text',
        automaticPowerOffTime: 'value',
    },
    powerSwitchProgramState: {
        operationMode: 'text',
        schedule: 'state',
    },
    routingState: {
        value: 'text',
    },
    // Twist
    multiswitchConfigurationState: {
        pages: 'list',
        supportedPages: 'list',
        locale: 'text',
        updateState: 'text',
    },
    // Motion Sensor
    latestMotionState: {
        latestMotionDetected: 'date',
    },
    walkTestState: {
        petImmunityState: 'text',
        walkState: 'text',
    },
    // Presence Simulation Configuration
    presenceSimulationConfigurationState: {
        enabled: 'switch',
        runningStartTime: 'date',
        runningEndTime: 'date',
    },
    presenceSimulationSchedulingState: {
        schedule: 'list',
    },
    // Yale
    doorSensor: {
        doorState: 'text',
    },
    lockActuator: {
        lockState: 'text',
    },
    airPurityGuardian: {
        enabled: 'switch',
    },
    motionlight: {
        enabled: 'switch',
        brightness: 'level.dimmer',
        darknessThresholdLux: 'level.color.luminance',
        lightsOffDelay: 'level.timer',
        illuminanceLux: 'level.color.luminance',
        lightIds: 'list',
    },
    waterAlarmSystemState: {
        available: 'indicator',
        visualActuatorsAvailable: 'switch',
        videoActuatorsAvailable: 'switch',
        deleted: 'indicator',
    },
    roomExtProperties: {
        humidity: 'value.humidity',
    },
    // instruction detection api data
    systemAvailability: {
        available: 'switch',
    },
    armingState: {
        remainingTimeUntilArmed: 'value',
        state: 'text',
    },
    alarmState: {
        value: 'text',
        incidents: 'list',
    },
    activeConfigurationProfile: {
        profileId: 'text',
    },
    securityGapState: {
        securityGaps: 'list',
    },
};
//# sourceMappingURL=roles.js.map