"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbRoomHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbRoomHandler extends bshb_handler_1.BshbHandler {
    cachedStates = new Map();
    handleDetection() {
        return this.detectRooms().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting rooms...'),
            finalize: () => this.bshb.log.info('Detecting rooms finished'),
        }));
    }
    handleBshcUpdate(resultEntry) {
        // {"iconId":"icon_room_living_room","extProperties":{"humidity":"81.5"},"@type":"room","name":"Wohnzimmer","id":"hz_2"}
        if (resultEntry['@type'] === 'room') {
            const idPrefix = `rooms.${resultEntry.id}`;
            Object.keys(resultEntry).forEach(key => {
                const id = `${idPrefix}.${key}`;
                if (key === 'extProperties') {
                    this.handleExtPropertiesUpdate(idPrefix, resultEntry[key]);
                }
                else {
                    this.handleDefaultUpdate(idPrefix, id, resultEntry, key);
                }
            });
        }
        return false;
    }
    handleDefaultUpdate(roomId, id, resultEntry, key) {
        (0, rxjs_1.from)(this.bshb.getObjectAsync(id))
            .pipe((0, rxjs_1.switchMap)(obj => {
            if (obj) {
                this.bshb.setState(id, {
                    val: this.mapValueToStorage(resultEntry[key]),
                    ack: true,
                });
                return (0, rxjs_1.of)(undefined);
            }
            else {
                return this.addRoom(resultEntry);
            }
        }))
            .subscribe(this.handleBshcUpdateError(`id=${roomId}, key=${key}`));
    }
    handleExtPropertiesUpdate(roomId, extProperties) {
        (0, rxjs_1.from)(Object.keys(extProperties)).pipe((0, rxjs_1.tap)(key => this.handleDefaultUpdate(roomId, `${roomId}.${key}`, extProperties, key)));
    }
    sendUpdateToBshc(_id, _state) {
        return (0, rxjs_1.of)(false);
    }
    detectRooms() {
        return this.setObjectNotExistsAsync('rooms', {
            type: 'folder',
            common: {
                name: 'Rooms',
                read: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getRooms({ timeout: this.long_timeout })), (0, rxjs_1.mergeMap)(response => (0, rxjs_1.from)(response.parsedResponse)), (0, rxjs_1.mergeMap)(room => this.addRoom(room)), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    addRoom(room) {
        // Cache room: hz_7 with: {"@type":"room","id":"hz_7","iconId":"icon_room_basement","name":"Test2"}
        // Cache room: hz_2 with: {"@type":"room","id":"hz_2","iconId":"icon_room_living_room","name":"Wohnzimmer","extProperties":{"humidity":"56.76"}}
        return this.setObjectNotExistsAsync(`rooms.${room.id}`, {
            type: 'folder',
            common: {
                name: room.name,
                read: true,
            },
            native: {},
        }).pipe((0, rxjs_1.tap)(() => this.addRoomEnum(room.name, 'rooms', room.id)), (0, rxjs_1.mergeMap)(() => (0, rxjs_1.from)(Object.keys(room))), (0, rxjs_1.mergeMap)(key => this.importState(key, room)));
    }
    importState(key, room) {
        if (key === '@type' || key === 'id') {
            return (0, rxjs_1.of)(undefined);
        }
        const id = `rooms.${room.id}.${key}`;
        const value = room[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            id: room.id,
            key: key,
        });
        if (key === 'extProperties') {
            return (0, rxjs_1.from)(Object.keys(room[key])).pipe((0, rxjs_1.mergeMap)(key => this.addExtProperties(key, room)));
        }
        else {
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: key,
                    type: bshb_definition_1.BshbDefinition.determineType(value),
                    role: bshb_definition_1.BshbDefinition.determineRole('room', key, value),
                    unit: bshb_definition_1.BshbDefinition.determineUnit('room', key),
                    read: true,
                    // TODO: Not sure yet how to write room values.
                    write: false,
                    // write: BshbDefinition.determineWrite('room', key)
                },
                native: {},
            }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, value)));
        }
    }
    addExtProperties(key, room) {
        const id = `rooms.${room.id}.${key}`;
        const value = room.extProperties[key];
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole('roomExtProperties', key, value),
                unit: bshb_definition_1.BshbDefinition.determineUnit('roomExtProperties', key),
                read: true,
                // TODO: Not sure yet how to write room values.
                write: false,
                // write: BshbDefinition.determineWrite('roomExtProperties', key)
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, value)));
    }
    name() {
        return 'roomHandler';
    }
}
exports.BshbRoomHandler = BshbRoomHandler;
//# sourceMappingURL=bshb-room-handler.js.map