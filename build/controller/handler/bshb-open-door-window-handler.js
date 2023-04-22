"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbOpenDoorWindowHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
class BshbOpenDoorWindowHandler extends bshb_handler_1.BshbHandler {
    handleDetection() {
        return this.detectOpenDoorsAndWindows().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting open doors/windows...'),
            finalize: () => this.bshb.log.info('Detecting open doors/windows finished')
        }));
    }
    handleBshcUpdate(resultEntry) {
        // we do something in case the state of a shutter contact changed
        const condition1 = resultEntry['@type'] === 'DeviceServiceData' && resultEntry.id === 'ShutterContact';
        // setting of device changed. Probably the profile. So we refresh
        const condition2 = resultEntry['@type'] === 'device' && Array.isArray(resultEntry.deviceServiceIds) &&
            resultEntry.deviceServiceIds.includes('ShutterContact');
        if (condition1 || condition2) {
            this.bshb.log.debug('Updating open doors/windows state...');
            this.detectOpenDoorsAndWindows()
                .subscribe(this.handleBshcUpdateError(`condition1=${condition1}, condition2=${condition2}`));
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        // not needed
        return false;
    }
    detectOpenDoorsAndWindows() {
        return this.getBshcClient().getOpenWindows({ timeout: this.long_timeout }).pipe((0, rxjs_1.tap)(() => this.setObjectNotExistsAsync('openDoorsAndWindows', {
            type: 'folder',
            common: {
                name: 'Open Doors / Windows',
                read: true
            },
            native: {
                id: 'openDoorsAndWindows'
            },
        })), (0, operators_1.switchMap)(result => {
            const idPrefix = 'openDoorsAndWindows.';
            const observables = [];
            observables.push(this.setAllState(idPrefix, result));
            observables.push(this.createGroup(idPrefix, 'all', 'All'));
            observables.push(this.createGroup(idPrefix, 'doors', 'Doors'));
            observables.push(this.createGroup(idPrefix, 'windows', 'Windows'));
            observables.push(this.createGroup(idPrefix, 'others', 'Others'));
            observables.push(this.setList(idPrefix, 'all.all', '--all--', 'All', result));
            observables.push(this.setList(idPrefix, 'all.open', '--allOpen--', 'All Open', result));
            observables.push(this.setList(idPrefix, 'all.unknown', '--allUnknown--', 'All Unknown', result));
            observables.push(this.setList(idPrefix, 'doors.all', 'allDoors', 'All doors', result));
            observables.push(this.setList(idPrefix, 'doors.open', 'openDoors', 'Open doors', result));
            observables.push(this.setList(idPrefix, 'doors.unknown', 'unknownDoors', 'Unknown doors', result));
            observables.push(this.setList(idPrefix, 'windows.all', 'allWindows', 'All windows', result));
            observables.push(this.setList(idPrefix, 'windows.open', 'openWindows', 'Open windows', result));
            observables.push(this.setList(idPrefix, 'windows.unknown', 'unknownWindows', 'Unknown windows', result));
            observables.push(this.setList(idPrefix, 'others.all', 'allOthers', 'All others', result));
            observables.push(this.setList(idPrefix, 'others.open', 'openOthers', 'Open others', result));
            observables.push(this.setList(idPrefix, 'others.unknown', 'unknownOthers', 'Unknown others', result));
            return (0, rxjs_1.concat)(...observables);
        }));
    }
    createGroup(idPrefix, id, name) {
        return this.setObjectNotExistsAsync(idPrefix + id, {
            type: 'folder',
            common: {
                name: name,
                read: true
            },
            native: {
                id: idPrefix + id,
                name: id
            },
        }).pipe((0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    setList(idPrefix, id, key, name, result) {
        return this.setListState(idPrefix, id, key, name, result).pipe((0, operators_1.switchMap)(() => this.setListCount(idPrefix, id, key, name, result)));
    }
    setListState(idPrefix, id, key, name, result) {
        const list = [];
        this.getElements(result, key).forEach((val) => {
            list.push(val.name);
        });
        return (0, rxjs_1.of)(list).pipe((0, operators_1.switchMap)(() => this.setObjectNotExistsAsync(idPrefix + id, {
            type: 'state',
            common: {
                name: name,
                type: 'array',
                role: 'list',
                read: true,
                write: false
            },
            native: {
                id: idPrefix + id,
                name: id
            },
        })), (0, rxjs_1.tap)(() => this.bshb.setState(idPrefix + id, { val: this.mapValueToStorage(list), ack: true })), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    setListCount(idPrefix, id, key, name, result) {
        return this.setObjectNotExistsAsync(idPrefix + id + 'Count', {
            type: 'state',
            common: {
                name: name + ' count',
                type: 'number',
                role: 'value',
                read: true,
                write: false
            },
            native: {
                id: idPrefix + id + 'Count',
                name: id + 'Count'
            },
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(idPrefix + id + 'Count', {
            val: this.getElements(result, key).length,
            ack: true
        })), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    getElements(result, key) {
        if (key.startsWith('--all')) {
            const groupPrefix = BshbOpenDoorWindowHandler.getGroupPrefix(key);
            let list = [];
            Object.keys(result.parsedResponse).forEach(itemKey => {
                if (itemKey.startsWith(groupPrefix)) {
                    list = list.concat(result.parsedResponse[itemKey]);
                }
            });
            return list;
        }
        else {
            if (typeof result.parsedResponse[key] === 'undefined' || result.parsedResponse[key] === null) {
                this.bshb.log.error(`Could not find open windows/doors with key=${key}`);
                return [];
            }
            else {
                return result.parsedResponse[key];
            }
        }
    }
    setAllState(idPrefix, result) {
        return this.setObjectNotExistsAsync(idPrefix + 'raw', {
            type: 'state',
            common: {
                name: 'Raw Data from BSHC',
                type: 'object',
                role: 'state',
                read: true,
                write: false
            },
            native: {
                id: idPrefix + 'raw',
                name: 'openDoorsAndWindows'
            },
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(idPrefix + 'raw', {
            val: this.mapValueToStorage(result.parsedResponse),
            ack: true
        })), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    static getGroupPrefix(key) {
        switch (key) {
            case '--all--':
            default:
                return 'all';
            case '--allOpen--':
                return 'open';
            case '--allUnknown--':
                return 'unknown';
        }
    }
    name() {
        return 'OpenDoorWindowHandler';
    }
}
exports.BshbOpenDoorWindowHandler = BshbOpenDoorWindowHandler;
//# sourceMappingURL=bshb-open-door-window-handler.js.map