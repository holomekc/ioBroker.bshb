"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
class BshbDefinition {
    static determineFunction(value) {
        if (value === 'TemperatureLevel' ||
            value === 'TemperatureOffset' ||
            value === 'Thermostat' ||
            value === 'ValveTappet' ||
            value === 'RoomClimateControl' ||
            value === 'TemperatureLevel' ||
            value === 'TemperatureLevelConfiguration') {
            return 'heating';
        }
        else if (value === 'ShutterContact') {
            // hmm
            // return '';
        }
        else if (value === 'IntrusionDetectionControl' ||
            value === 'SurveillanceAlarm') {
            return 'security';
        }
        else if (value === 'VentilationDelay') {
            // not sure...
            return 'heating';
        }
        else if (value === 'CommunicationQuality') {
            return 'communicationQuality';
        }
        else if (value === 'BatteryLevel') {
            return 'battery';
        }
        else if (value === 'AirQualityLevel') {
            return 'airQuality';
        }
        else if (value === 'SmokeSensitivity') {
            return 'smokeSensitivity';
        }
        return undefined;
    }
    /**
     * Get type of a value from bsh
     *
     * @param value value to determine type for
     */
    static determineType(value) {
        return typeof value;
    }
    /**
     * Get role of bsh device state
     * @param type
     *        '@type' of bsh
     * @param key
     *        key of a device state
     */
    static determineRole(type, key) {
        // faults are always a list. Does not matter which service.
        if (key === 'faults') {
            return 'list';
        }
        if (type === 'binarySwitchState') {
            if (key === 'on') {
                return 'switch';
            }
        }
        else if (type === 'temperatureLevelState') {
            if (key === 'temperature') {
                return 'value.temperature';
            }
        }
        else if (type === 'colorState') {
            if (key === 'rgb') {
                return 'level.color.rgb';
            }
        }
        else if (type === 'climateControlState') {
            if (key === 'setpointTemperature' ||
                key === 'setpointTemperatureForLevelEco' ||
                key === 'setpointTemperatureForLevelComfort') {
                return 'level.temperature';
            }
            else if (key === 'low') {
                return 'indicator.lowbat';
            }
            else if (key === 'boostMode') {
                return 'switch.boost';
            }
            else if (key === 'operationMode') {
                return 'text';
            }
            else if (key === 'showSetpointTemperature' || key === 'summerMode') {
                return 'switch';
            }
            else if (key === 'supportsBoostMode' || key === 'ventilationMode') {
                return 'indicator';
            }
        }
        else if (type === 'colorTemperatureState') {
            if (key === 'colorTemperature') {
                return 'level.color.temperature';
            }
        }
        else if (type === 'multiLevelSwitchState') {
            if (key === 'level') {
                return 'level.dimmer';
            }
        }
        else if (type === 'temperatureOffsetState') {
            if (key === 'offset' || key === 'stepSize' || key === 'minOffset' || key === 'maxOffset') {
                return 'level';
            }
        }
        else if (type === 'childLockState') {
            if (key === 'childLock') {
                return 'text';
            }
        }
        else if (type === 'valveTappetState') {
            if (key === 'position') {
                return 'level.valve';
            }
            else if (key === 'value') {
                return 'text';
            }
        }
        else if (type === 'shutterContactState') {
            if (key === 'value') {
                // TODO: We could add a mapping for some values. In this case true -> OPEN, false -> CLOSED
                // sensor.window would be great but this would require a boolean and this is a string
                // OPEN / CLOSED
                return 'text';
            }
        }
        // Twinguard
        else if (type === 'smokeSensitivityState') {
            if (key === 'smokeSensitivity') {
                return 'text';
            }
            else if (key === 'preAlarmEnabled') {
                return 'indicator';
            }
        }
        else if (type === 'twinguardNightlyPromiseState') {
            if (key === 'nightlyPromiseEnabled') {
                return 'indicator';
            }
        }
        else if (type === 'communicationQualityState') {
            if (key === 'quality') {
                return 'text';
            }
        }
        else if (type === 'airQualityLevelState') {
            if (key === 'combinedRating') {
                return 'text';
            }
            else if (key === 'description') {
                return 'text';
            }
            else if (key === 'temperature') {
                return 'value.temperature';
            }
            else if (key === 'temperatureRating') {
                return 'text';
            }
            else if (key === 'humidity') {
                return 'value.humidity';
            }
            else if (key === 'humidityRating') {
                return 'text';
            }
            else if (key === 'purity') {
                return 'value';
            }
            else if (key === 'purityRating') {
                return 'text';
            }
        }
        else if (type === 'smokeDetectorCheckState') {
            if (key === 'value') {
                return 'text';
            }
        }
        else if (type === 'surveillanceAlarmState') {
            if (key === 'value') {
                return 'text';
            }
            else if (key === 'incidents') {
                return 'list';
            }
        }
        else if (type === 'intrusionDetectionControlState') {
            if (key === 'value') {
                return 'text';
            }
            else if (key === 'triggers') {
                return 'list';
            }
            else if (key === 'actuators') {
                return 'list';
            }
            else if (key === 'armActivationDelayTime') {
                return 'level';
            }
            else if (key === 'alarmActivationDelayTime') {
                return 'level';
            }
        }
        else if (type === 'hueBridgeSearcherState') {
            if (key === 'searcherState') {
                return 'text';
            }
            else if (key === 'value') {
                return 'text';
            }
        }
        else if (type === 'armDisarmPushNotificationState') {
            if (key === 'state') {
                return 'text';
            }
        }
        else if (type === 'remoteAccessState') {
            if (key === 'state') {
                return 'text';
            }
        }
        else if (type === 'remotePushNotificationState') {
            if (key === 'state') {
                return 'text';
            }
        }
        else if (type === 'softwareUpdateState') {
            if (key === 'swUpdateState' || key === 'swUpdateLastResult' ||
                key === 'swUpdateAvailableVersion' || key === 'swInstalledVersion') {
                return 'text';
            }
        }
        else if (type === 'ventilationDelayState') {
            if (key === 'devices') {
                return 'list';
            }
            else if (key === 'delay') {
                return 'level';
            }
        }
        // else if (type === '') {
        //     if (key === '') {
        //
        //     } else if (key === '') {
        //
        //     }
        // }
        return 'state';
    }
}
exports.BshbDefinition = BshbDefinition;
