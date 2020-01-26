"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
const roles_1 = require("./definition/roles");
const function_1 = require("./definition/function");
class BshbDefinition {
    static determineFunction(value) {
        const func = function_1.FUNCTIONS[value];
        if (func !== null && typeof func !== 'undefined') {
            return func;
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
        const roleType = roles_1.ROLES[type];
        if (roleType !== null && typeof roleType !== 'undefined') {
            const role = roleType[key];
            if (role !== null && typeof role !== 'undefined') {
                return role;
            }
        }
        return 'state';
    }
}
exports.BshbDefinition = BshbDefinition;
