"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATES = void 0;
const enabledDisabled = {
    ENABLED: 'ENABLED',
    DISABLED: 'DISABLED',
};
const rating = {
    GOOD: 'GOOD',
    MEDIUM: 'MEDIUM',
    BAD: 'BAD',
    UNKNOWN: 'UNKNOWN',
};
exports.STATES = {
    armDisarmPushNotificationState: {
        state: enabledDisabled,
    },
    remoteAccessState: {
        state: enabledDisabled,
    },
    remotePushNotificationState: {
        state: enabledDisabled,
    },
    softwareUpdateState: {
        swUpdateState: {
            NO_UPDATE_AVAILABLE: 'NO_UPDATE_AVAILABLE',
            DOWNLOADING: 'DOWNLOADING',
            UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
            UPDATE_IN_PROGRESS: 'UPDATE_IN_PROGRESS',
        },
        swUpdateLastResult: {
            UPDATE_SUCCESS: 'UPDATE_SUCCESS',
            UPDATE_FAIL: 'UPDATE_FAIL',
            DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
        },
    },
    cameraNotificationState: {
        value: enabledDisabled,
    },
    privacyModeState: {
        value: enabledDisabled,
    },
    childLockState: {
        childLock: {
            ON: 'ON',
            OFF: 'OFF',
        },
    },
    valveTappetState: {
        value: {
            NOT_AVAILABLE: 'NOT_AVAILABLE',
            RUN_TO_START_POSITION: 'RUN_TO_START_POSITION',
            START_POSITION_REQUESTED: 'START_POSITION_REQUESTED',
            IN_START_POSITION: 'IN_START_POSITION',
            VALVE_ADAPTION_REQUESTED: 'VALVE_ADAPTION_REQUESTED',
            VALVE_ADAPTION_IN_PROGRESS: 'VALVE_ADAPTION_IN_PROGRESS',
            VALVE_ADAPTION_SUCCESSFUL: 'VALVE_ADAPTION_SUCCESSFUL',
            VALVE_TOO_TIGHT: 'VALVE_TOO_TIGHT',
            RANGE_TOO_BIG: 'RANGE_TOO_BIG',
            RANGE_TOO_SMALL: 'RANGE_TOO_SMALL',
            ERROR: 'ERROR',
            UNKNOWN: 'UNKNOWN',
        },
    },
    shutterContactState: {
        value: {
            OPEN: 'OPEN',
            CLOSED: 'CLOSED',
        },
    },
    powerSwitchState: {
        switchState: {
            ON: 'ON',
            OFF: 'OFF',
        },
    },
    powerSwitchProgramState: {
        operationMode: {
            MANUAL: 'MANUAL',
            SCHEDULE: 'SCHEDULE',
        },
    },
    routingState: {
        value: enabledDisabled,
    },
    hueBlinkingState: {
        blinkingState: {
            OFF: 'OFF',
            ON: 'ON',
            UNKNOWN: 'UNKNOWN',
        },
    },
    hueBridgeSearcherState: {
        searcherState: {
            BRIDGE_SEARCH_REQUESTED: 'BRIDGE_SEARCH_REQUESTED',
            BRIDGE_SEARCH_STARTED: 'BRIDGE_SEARCH_STARTED',
            BRIDGES_FOUND: 'BRIDGES_FOUND',
            NO_BRIDGE_FOUND: 'NO_BRIDGE_FOUND',
            ERROR: 'ERROR',
            UNKNOWN: 'UNKNOWN',
        },
        value: {
            BRIDGE_SEARCH_REQUESTED: 'BRIDGE_SEARCH_REQUESTED',
            BRIDGE_SEARCH_STARTED: 'BRIDGE_SEARCH_STARTED',
            BRIDGES_FOUND: 'BRIDGES_FOUND',
            NO_BRIDGE_FOUND: 'NO_BRIDGE_FOUND',
            ERROR: 'ERROR',
            UNKNOWN: 'UNKNOWN',
        },
    },
    communicationQualityState: {
        quality: {
            GOOD: 'GOOD',
            BAD: 'BAD',
            NORMAL: 'NORMAL',
            UNKNOWN: 'UNKNOWN',
            FETCHING: 'FETCHING',
        },
        requestState: {
            REQUEST: 'REQUEST',
        },
    },
    multiswitchConfigurationState: {
        updateState: {
            UPDATING: 'UPDATING',
            UP_TO_DATE: 'UP_TO_DATE',
            UNKNOWN: 'UNKNOWN',
        },
    },
    airQualityLevelState: {
        combinedRating: rating,
        description: {
            OK: 'OK',
            COLD: 'COLD',
            COLD_DRY: 'COLD_DRY',
            COLD_HUMID: 'COLD_HUMID',
            COLD_STUFFY: 'COLD_STUFFY',
            COLD_DRY_STUFFY: 'COLD_DRY_STUFFY',
            COLD_HUMID_STUFFY: 'COLD_HUMID_STUFFY',
            LITTLE_COLD: 'LITTLE_COLD',
            LITTLE_DRY: 'LITTLE_DRY',
            LITTLE_HUMID: 'LITTLE_HUMID',
            LITTLE_STUFFY: 'LITTLE_STUFFY',
            LITTLE_WARM: 'LITTLE_WARM',
            DRY: 'DRY',
            DRY_STUFFY: 'DRY_STUFFY',
            HUMID: 'HUMID',
            HUMID_STUFFY: 'HUMID_STUFFY',
            STUFFY: 'STUFFY',
            WARM: 'WARM',
            WARM_DRY: 'WARM_DRY',
            WARM_HUMID: 'WARM_HUMID',
            WARM_STUFFY: 'WARM_STUFFY',
            WARM_HUMID_STUFFY: 'WARM_HUMID_STUFFY',
            WARM_DRY_STUFFY: 'WARM_DRY_STUFFY',
            UNKNOWN: 'UNKNOWN',
        },
        temperatureRating: rating,
        humidityRating: rating,
        purityRating: rating,
    },
    smokeDetectorCheckState: {
        value: {
            NONE: 'NONE',
            SMOKE_TEST_OK: 'SMOKE_TEST_OK',
            SMOKE_TEST_FAILED: 'SMOKE_TEST_FAILED',
            SMOKE_TEST_REQUESTED: 'SMOKE_TEST_REQUESTED',
            COMMUNICATION_TEST_SENT: 'COMMUNICATION_TEST_SENT',
            COMMUNICATION_TEST_OK: 'COMMUNICATION_TEST_OK',
            COMMUNICATION_TEST_REQUESTED: 'COMMUNICATION_TEST_REQUESTED',
        },
    },
    smokeSensitivityState: {
        smokeSensitivity: {
            HIGH: 'HIGH',
            MIDDLE: 'MIDDLE',
            LOW: 'LOW',
            UNKNOWN: 'UNKNOWN',
        },
    },
    walkTestState: {
        walkState: {
            WALK_TEST_STARTED: 'WALK_TEST_STARTED',
            WALK_TEST_STOPPED: 'WALK_TEST_STOPPED',
            WALK_TEST_UNKNOWN: 'WALK_TEST_UNKNOWN',
        },
        petImmunityState: {
            WALK_TEST_STARTED: 'WALK_TEST_STARTED',
            WALK_TEST_STOPPED: 'WALK_TEST_STOPPED',
            WALK_TEST_UNKNOWN: 'WALK_TEST_UNKNOWN',
        },
    },
    intrusionDetectionControlState: {
        value: {
            SYSTEM_ARMING: 'SYSTEM_ARMING',
            SYSTEM_ARMED: 'SYSTEM_ARMED',
            SYSTEM_DISARMED: 'SYSTEM_DISARMED',
            MUTE_ALARM: 'MUTE_ALARM',
        },
    },
    surveillanceAlarmState: {
        value: {
            ALARM_ON: 'ALARM_ON',
            ALARM_OFF: 'ALARM_OFF',
            ALARM_MUTED: 'ALARM_MUTED',
            PRE_ALARM: 'PRE_ALARM',
            UNKNOWN: 'UNKNOWN',
        },
    },
    climateControlState: {
        operationMode: {
            MANUAL: 'MANUAL',
            AUTOMATIC: 'AUTOMATIC',
            OFF: 'OFF',
            UNKNOWN: 'UNKNOWN',
        },
        roomControlMode: {
            OFF: 'OFF',
            HEATING: 'HEATING',
            COOLING: 'COOLING',
            UNKNOWN: 'UNKNOWN',
        },
    },
    // Yale
    doorSensor: {
        doorState: {
            DOOR_CLOSED: 'DOOR_CLOSED',
            DOOR_OPEN: 'DOOR_OPEN',
            DOOR_UNKNOWN: 'DOOR_UNKNOWN',
        },
    },
    lockActuator: {
        lockState: {
            UNLOCKED: 'UNLOCKED',
            LOCKED: 'LOCKED',
            LOCKING: 'LOCKING',
            UNLOCKING: 'UNLOCKING',
        },
    },
    waterAlarmSystemState: {
        state: {
            WATER_ALARM: 'WATER_ALARM',
            ALARM_OFF: 'ALARM_OFF',
            ALARM_MUTED: 'ALARM_MUTED',
        },
    },
    ClimateSchedule: {
        ScheduleType: {
            CUSTOM: 'CUSTOM',
            SYSTEM: 'SYSTEM',
        },
    },
    // instruction detection api data
    armingState: {
        state: {
            SYSTEM_ARMING: 'SYSTEM_ARMING',
            SYSTEM_ARMED: 'SYSTEM_ARMED',
            SYSTEM_DISARMED: 'SYSTEM_DISARMED',
        },
    },
    alarmState: {
        value: {
            ALARM_OFF: 'ALARM_OFF',
            PRE_ALARM: 'PRE_ALARM',
            ALARM_ON: 'ALARM_ON',
            ALARM_MUTED: 'ALARM_MUTED',
            UNKNOWN: 'UNKNOWN',
        },
    },
    BackupStatus: {
        state: {
            NONE: 'NONE',
            IN_PROGRESS: 'IN_PROGRESS',
            READY: 'READY',
        },
    },
    RestoreStatus: {
        state: {
            NONE: 'NONE',
            BACKUP_UPLOADED: 'BACKUP_UPLOADED',
            RESTORE_AUTHORIZED: 'RESTORE_AUTHORIZED',
            VALIDATING: 'VALIDATING',
            RESTORING: 'RESTORING',
            RESTORED: 'RESTORED',
            RESTORED_OTHER_SHC: 'RESTORED_OTHER_SHC',
            ERROR: 'ERROR',
        },
    },
};
//# sourceMappingURL=states.js.map