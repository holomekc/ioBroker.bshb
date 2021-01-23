/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
import {ROLES} from "./definition/roles";
import {FUNCTIONS} from "./definition/function";
import {UNITS} from "./definition/units";
import {STATES} from "./definition/states";

export class BshbDefinition {

    public static determineFunction(value: string): string {
        const func = FUNCTIONS[value];
        if (func !== null && typeof func !== 'undefined') {
            return func;
        }
        return undefined as unknown as string;
    }

    /**
     * Get type of a value from bsh
     *
     * @param value value to determine type for
     */
    public static determineType(value: any): 'number' | 'string' | 'boolean' | 'array' | 'object' | 'mixed' | 'file' {
        if (Array.isArray(value)) {
            return 'array';
        }
        return (typeof value) as 'number' | 'string' | 'boolean' | 'array' | 'object' | 'mixed' | 'file';
    }


    /**
     * Get role of bsh device state
     * @param type
     *        '@type' of bsh
     * @param key
     *        key of a device state
     */
    public static determineRole(type: string, key: string): string {
        // faults are always a list. Does not matter which service.
        if (key === 'faults') {
            return 'list';
        }

        const roleType = ROLES[type];

        if (roleType !== null && typeof roleType !== 'undefined') {
            const role = roleType[key];

            if (role !== null && typeof role !== 'undefined') {
                return role;
            }
        }

        return 'state';
    }

    public static determineUnit(type: string, key: string): string | undefined {
        const unitType = UNITS[type];

        if (unitType !== null && typeof unitType !== 'undefined') {
            const unit = unitType[key];

            if (unit !== null && typeof unit !== 'undefined') {
                return unit;
            }
        }

        return undefined;
    }

    static determineStates(type: any, key: string): Record<string, string> | string | undefined {
        const stateType = STATES[type];

        if (stateType !== null && typeof stateType !== 'undefined') {
            const state = stateType[key];

            if (state !== null && typeof state !== 'undefined') {
                return state;
            }
        }

        return undefined;
    }
}


