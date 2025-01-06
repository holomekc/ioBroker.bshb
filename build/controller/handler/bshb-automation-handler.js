"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbAutomationHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
/**
 * This handler is used to detect automations of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbAutomationHandler extends bshb_handler_1.BshbHandler {
    automationRegex = /bshb\.\d+\.automations\.(.+?)\.(.+)/;
    handleDetection() {
        return this.detectAutomations().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting automations...'),
            finalize: () => this.bshb.log.info('Detecting automations finished')
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry['@type'] === 'automationRule') {
            this.detectAutomations().subscribe();
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.automationRegex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            const automationId = match[1];
            const key = match[2];
            this.bshb.log.debug(`Found automation with id=${automationId}, key=${key} and value=${state.val}`);
            if (key === 'trigger') {
                result = this.getBshcClient().triggerAutomation(automationId, { timeout: this.long_timeout })
                    .pipe((0, operators_1.delay)(1000), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setState(id, {
                    val: false,
                    ack: true
                }))), (0, rxjs_1.tap)(this.handleBshcSendError(`id=${automationId}, value=${state.val}, key=${key}, automationId=${automationId}`)), (0, rxjs_1.map)(() => true));
            }
            else {
                const idPrefix = 'automations.' + automationId;
                const data = {};
                data['@type'] = 'automationRule';
                data.id = automationId;
                result = (0, rxjs_1.from)(this.addAutomationValue(idPrefix, 'enabled', data)
                    .then(() => this.addAutomationValue(idPrefix, 'name', data))
                    .then(() => this.addAutomationValue(idPrefix, 'automationConditions', data, val => JSON.parse(val)))
                    .then(() => this.addAutomationValue(idPrefix, 'automationTriggers', data, val => JSON.parse(val)))
                    .then(() => this.addAutomationValue(idPrefix, 'automationActions', data, val => JSON.parse(val)))
                    .then(() => this.addAutomationValue(idPrefix, 'conditionLogicalOp', data)))
                    .pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().setAutomation(automationId, data, { timeout: this.long_timeout })), (0, rxjs_1.tap)(this.handleBshcSendError(`id=${automationId}, value=${state.val}, data=${JSON.stringify(data)}`)), (0, rxjs_1.map)(() => true));
            }
        }
        return result;
    }
    async addAutomationValue(idPrefix, key, data, mapFnc) {
        let state = await this.bshb.getStateAsync(`${idPrefix}.${key}`);
        if (mapFnc) {
            return (data[key] = mapFnc((state).val));
        }
        else {
            return (data[key] = (state).val);
        }
    }
    detectAutomations() {
        return this.setObjectNotExistsAsync('automations', {
            type: 'folder',
            common: {
                name: 'automations',
                read: true
            },
            native: {
                id: 'automations'
            },
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getAutomations(undefined, { timeout: this.long_timeout })), (0, rxjs_1.switchMap)(response => this.deleteMissingAutomations((response.parsedResponse)).pipe((0, rxjs_1.last)(undefined, void 0), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(response.parsedResponse)))), (0, rxjs_1.mergeMap)(automation => {
            this.bshb.log.debug(`Found automation ${automation.id}, ${automation.name}`);
            const id = 'automations.' + automation.id;
            // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
            return (0, rxjs_1.from)(this.bshb.setObject(id, {
                type: 'folder',
                common: {
                    name: automation.name,
                    type: 'boolean',
                    role: 'switch',
                    write: true,
                    read: false
                },
                native: {
                    id: automation.id,
                    name: automation.name
                },
            })).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.enabled`, {
                type: 'state',
                common: {
                    name: 'enabled',
                    type: 'boolean',
                    role: 'switch',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.enabled`,
                    name: 'enabled'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.enabled`, { val: automation.enabled, ack: true })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.name`, {
                type: 'state',
                common: {
                    name: 'name',
                    type: 'string',
                    role: 'text',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.name`,
                    name: 'name'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.name`, { val: automation.name, ack: true })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.trigger`, {
                type: 'state',
                common: {
                    name: 'trigger',
                    type: 'boolean',
                    role: 'switch',
                    write: true,
                    read: false
                },
                native: {
                    id: `${id}.trigger`,
                    name: 'trigger'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.trigger`, { val: false, ack: true })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.automationConditions`, {
                type: 'state',
                common: {
                    name: 'automationConditions',
                    type: 'array',
                    role: 'list',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.automationConditions`,
                    name: 'automationConditions'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.automationConditions`, {
                val: this.mapValueToStorage(automation.automationConditions),
                ack: true
            })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.automationTriggers`, {
                type: 'state',
                common: {
                    name: 'automationTriggers',
                    type: 'array',
                    role: 'list',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.automationTriggers`,
                    name: 'automationTriggers'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.automationTriggers`, {
                val: this.mapValueToStorage(automation.automationTriggers),
                ack: true
            })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.automationActions`, {
                type: 'state',
                common: {
                    name: 'automationActions',
                    type: 'array',
                    role: 'list',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.automationActions`,
                    name: 'automationActions'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.automationActions`, {
                val: this.mapValueToStorage(automation.automationActions),
                ack: true
            })), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setObject(`${id}.conditionLogicalOp`, {
                type: 'state',
                common: {
                    name: 'conditionLogicalOp',
                    type: 'string',
                    role: 'text',
                    write: true,
                    read: true
                },
                native: {
                    id: `${id}.conditionLogicalOp`,
                    name: 'conditionLogicalOp'
                },
            }))), (0, rxjs_1.tap)(() => this.bshb.setState(`${id}.conditionLogicalOp`, {
                val: automation.conditionLogicalOp,
                ack: true
            })));
        }), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    deleteMissingAutomations(automations) {
        return (0, rxjs_1.from)(this.bshb.getStatesOfAsync('automations', '')).pipe((0, rxjs_1.switchMap)(objects => (0, rxjs_1.from)(objects)), (0, rxjs_1.switchMap)(object => {
            let found = false;
            for (let i = 0; i < automations.length; i++) {
                if (object.native.id === automations[i].id) {
                    // found automation
                    found = true;
                    break;
                }
            }
            if (!found) {
                return (0, rxjs_1.from)(this.bshb.delObjectAsync(`automations.${object.native.id}`)).pipe((0, rxjs_1.tap)(() => this.bshb.log.info(`automation with id=${object.native.id} removed because it does not exist anymore.`)), (0, operators_1.catchError)(err => {
                    this.bshb.log.error(`Could not delete automation with id=${object.native.id} because: ` + err);
                    return (0, rxjs_1.of)(undefined);
                }));
            }
            else {
                return (0, rxjs_1.of)(undefined);
            }
        }));
    }
    name() {
        return 'automationHandler';
    }
}
exports.BshbAutomationHandler = BshbAutomationHandler;
//# sourceMappingURL=bshb-automation-handler.js.map