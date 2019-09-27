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
                return 'level.temperature';
            }
        } else if (type === 'colorState') {
            if (key === 'rgb') {
                return 'level.color.rgb';
            }
        } else if (type === 'climateControlState') {
            if (key === 'setpointTemperature') {
                return 'level.temperature';
            } else if (key === 'setpointTemperatureForLevelEco') {
                return 'level.temperature';
            } else if (key === 'setpointTemperatureForLevelComfort') {
                return 'level.temperature';
            } else if (key === 'low') {
                return 'indicator.lowbat';
            } else if (key === 'boostMode') {
                return 'switch.boost';
            }
        } else if (type === 'colorTemperatureState') {
            if (key === 'colorTemperature') {
                return 'level.color.temperature';
            }
        } else if (type === 'multiLevelSwitchState') {
            if (key === 'level') {
                return 'level.dimmer';
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


