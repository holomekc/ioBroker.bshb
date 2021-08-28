"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbDefinition = void 0;
/**
 * This class contains definitions for iobroker based on bshb data
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
const roles_1 = require("./definition/roles");
const function_1 = require("./definition/function");
const units_1 = require("./definition/units");
const states_1 = require("./definition/states");
const write_1 = require("./definition/write");
class BshbDefinition {
    static determineFunction(value) {
        const func = function_1.FUNCTIONS[value];
        if (func !== null && typeof func !== 'undefined') {
            return func;
        }
        return undefined;
    }
    /**
     * Check if value can be written by type and key. Default is true.
     *
     * @param type
     *        '@type' of bsh
     * @param key
     *        key of a device state
     */
    static determineWrite(type, key) {
        const writeType = write_1.WRITE[type];
        if (writeType !== null && typeof writeType !== 'undefined') {
            const write = writeType[key];
            if (write !== null && typeof write !== 'undefined') {
                return write;
            }
        }
        return true;
    }
    /**
     * Get type of a value from bsh
     *
     * @param value value to determine type for
     */
    static determineType(value) {
        if (Array.isArray(value)) {
            return 'array';
        }
        return (typeof value);
    }
    /**
     * Get role of bsh device state
     * @param type
     *        '@type' of bsh
     * @param key
     *        key of a device state
     *@param value
     *       value of a device state
     */
    static determineRole(type, key, value) {
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
        if (Array.isArray(value)) {
            return 'list';
        }
        return 'state';
    }
    static determineUnit(type, key) {
        const unitType = units_1.UNITS[type];
        if (unitType !== null && typeof unitType !== 'undefined') {
            const unit = unitType[key];
            if (unit !== null && typeof unit !== 'undefined') {
                return unit;
            }
        }
        return undefined;
    }
    static determineStates(type, key) {
        const stateType = states_1.STATES[type];
        if (stateType !== null && typeof stateType !== 'undefined') {
            const state = stateType[key];
            if (state !== null && typeof state !== 'undefined') {
                return state;
            }
        }
        return undefined;
    }
}
exports.BshbDefinition = BshbDefinition;
