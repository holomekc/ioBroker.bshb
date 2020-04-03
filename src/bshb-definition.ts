/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
import {ROLES} from "./definition/roles";
import {FUNCTIONS} from "./definition/function";

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
    public static determineType(value: any): string {
        if (Array.isArray(value)) {
            return 'array';
        }
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
}


