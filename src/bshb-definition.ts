/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbDefinition{

    /**
     * Get type of a value from bsh
     *
     * @param value value to determine type for
     */
    public static determineType(value: any): string {
        return typeof value;
    }

    /**
     * Get role of bsh device state
     * @param type
     *        '@type' of bsh
     * @param key
     *        key of a device state
     */
    public static determineRole(type: string, key: string): string {
        if (type === 'binarySwitchState') {
            if (key === 'on') {
                return 'switch';
            }
        } else if (type === 'temperatureLevelState') {
            if (key === 'temperature') {
                return 'value.temperature';
            }
        } else if (type === 'colorState') {
            if (key === 'rgb') {
                return 'level.color.rgb';
            }
        } else if (type === 'climateControlState') {
            if (key === 'setpointTemperature' ||
                key === 'setpointTemperatureForLevelEco' ||
                key === 'setpointTemperatureForLevelComfort') {
                return 'level.temperature';
            } else if (key === 'low') {
                return 'indicator.lowbat';
            } else if (key === 'boostMode') {
                return 'switch.boost';
            } else if (key === 'operationMode') {
                return 'text';
            } else if (key === 'showSetpointTemperature' || key === 'summerMode') {
                return 'switch';
            } else if (key === 'supportsBoostMode' || key === 'ventilationMode') {
                return 'indicator';
            }
        } else if (type === 'colorTemperatureState') {
            if (key === 'colorTemperature') {
                return 'level.color.temperature';
            }
        } else if (type === 'multiLevelSwitchState') {
            if (key === 'level') {
                return 'level.dimmer';
            }
        } else if(type === 'temperatureOffsetState') {
            if (key === 'offset' || key === 'stepSize' || key === 'minOffset' || key === 'maxOffset') {
                return 'level';
            }
        } else if(type === 'childLockState') {
            if (key === 'childLock') {
                return 'text';
            }
        } else if(type === 'valveTappetState') {
            if (key === 'position') {
                return 'level.valve';
            } else if(key === 'value') {
                return 'text';
            }
        } else if(type === 'shutterContactState') {
            if (key === 'value') {
                // TODO: We could add a mapping for some values. In this case true -> OPEN, false -> CLOSED
                // sensor.window would be great but this would require a boolean and this is a string
                // OPEN / CLOSED
                return 'text ';
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


