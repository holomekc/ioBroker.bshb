"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbBackupHandler = void 0;
const rxjs_1 = require("rxjs");
const bshb_handler_1 = require("./bshb-handler");
const bshb_definition_1 = require("../../bshb-definition");
const utils = __importStar(require("@iobroker/adapter-core"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class BshbBackupHandler extends bshb_handler_1.BshbHandler {
    backupRegex = /bshb\.\d+\.backup\.(createBackup|deleteBackup)/;
    backupStatus$ = new rxjs_1.Subject();
    name() {
        return 'backupHandler';
    }
    handleDetection() {
        return this.detectBackup().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting backup information...'),
            finalize: () => this.bshb.log.info('Detecting backup information finished'),
        }));
    }
    handleBshcUpdate(resultEntry) {
        let prefix = undefined;
        if (resultEntry['@type'] === 'BackupStatus') {
            this.bshb.log.debug('Updating backup status...');
            prefix = 'backup.backupStatus';
        }
        else if (resultEntry['@type'] === 'RestoreStatus') {
            this.bshb.log.debug('Updating restore status...');
            prefix = 'backup.restoreStatus';
        }
        if (prefix) {
            for (const [key, value] of Object.entries(resultEntry)) {
                if (key === '@type') {
                    continue;
                }
                const id = `${prefix}.${key}`;
                (0, rxjs_1.from)(this.bshb.setState(id, {
                    val: value,
                    ack: true,
                }))
                    .pipe((0, rxjs_1.tap)(() => {
                    if (key === 'state') {
                        // internal backup status propagation after ioBroker state update.
                        // Prevent a racing condition and make sure that a user is able to read the
                        // READY state as well. In general the process of downloading and storing the file
                        // should be super quick, so READY is most likely not visible for that long.
                        this.backupStatus$.next(value + '');
                    }
                }))
                    .subscribe(this.handleBshcUpdateError(`id=${id}`));
            }
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.backupRegex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            if (state.val) {
                if (id.endsWith('createBackup')) {
                    result = this.createBackup().pipe((0, rxjs_1.switchMap)(() => this.waitForReadyState()), (0, rxjs_1.switchMap)(() => this.getBackup()), (0, rxjs_1.switchMap)(response => this.storeBackupFile(response)), (0, rxjs_1.switchMap)(() => this.deleteBackupFromController()), (0, rxjs_1.switchMap)(() => {
                        this.bshb.log.debug('[Backup] Backup file stores. Delete file on controller.');
                        return (0, rxjs_1.from)(this.bshb.setState(id, { val: false, ack: true }));
                    }), (0, rxjs_1.tap)(this.handleBshcUpdateError(`id=${id}`)), (0, rxjs_1.map)(() => true));
                }
                else {
                    this.bshb.log.debug('Delete backup from controller triggered');
                    result = this.getBshcClient()
                        .deleteBackup({ timeout: this.long_timeout })
                        .pipe((0, rxjs_1.switchMap)(_ => (0, rxjs_1.from)(this.bshb.setState(id, { val: false, ack: true }))), (0, rxjs_1.tap)(this.handleBshcUpdateError(`id=${id}`)), (0, rxjs_1.map)(() => true));
                }
            }
            else {
                result = (0, rxjs_1.of)(true);
            }
        }
        return result;
    }
    createBackup() {
        this.bshb.log.debug('[Backup] Creating backup triggered');
        return this.getBshcClient().createBackup(this.bshb.config.systemPassword, undefined, {
            timeout: this.long_timeout,
        });
    }
    waitForReadyState() {
        this.bshb.log.debug('[Backup] Backup creation triggered. Waiting for READY state');
        return this.backupStatus$.pipe((0, rxjs_1.filter)(status => status === 'READY'), (0, rxjs_1.take)(1));
    }
    getBackup() {
        this.bshb.log.debug('[Backup] READY state received. Downloading data.');
        return this.getBshcClient().getBackup();
    }
    storeBackupFile(response) {
        const binaryResponse = response.parsedResponse;
        const backupDir = path_1.default.join(utils.getAbsoluteInstanceDataDir(this.bshb), 'backups');
        return (0, rxjs_1.from)(this.ensureDirectoryExists(backupDir)).pipe((0, rxjs_1.switchMap)(() => {
            const filePath = path_1.default.join(backupDir, this.createFileName(binaryResponse.fileName));
            this.bshb.log.info(`[Backup] Data downloaded and file created: ${filePath}.`);
            return (0, rxjs_1.from)(fs_1.promises.writeFile(filePath, binaryResponse.data));
        }));
    }
    deleteBackupFromController() {
        return this.getBshcClient().deleteBackup({ timeout: this.long_timeout });
    }
    detectBackup() {
        return this.createBackupFolder().pipe((0, rxjs_1.switchMap)(() => this.createBackupStatusFolder()), (0, rxjs_1.switchMap)(() => this.getBshcClient()
            .getBackupStatus({ timeout: this.long_timeout })
            .pipe((0, rxjs_1.mergeMap)(response => (0, rxjs_1.from)(Object.entries(response.parsedResponse))), (0, rxjs_1.filter)(([key, _]) => key !== '@type'), (0, rxjs_1.mergeMap)(([key, value]) => this.addState('backup.backupStatus', 'BackupStatus', key, value)))), (0, rxjs_1.switchMap)(() => this.createRestoreStatusFolder()), (0, rxjs_1.switchMap)(() => this.getBshcClient()
            .getRestoreStatus({ timeout: this.long_timeout })
            .pipe((0, rxjs_1.mergeMap)(response => (0, rxjs_1.from)(Object.entries(response.parsedResponse))), (0, rxjs_1.filter)(([key, _]) => key !== '@type'), (0, rxjs_1.mergeMap)(([key, value]) => this.addState('backup.restoreStatus', 'RestoreStatus', key, value)))), (0, rxjs_1.switchMap)(() => this.createBackupState()), (0, rxjs_1.switchMap)(() => this.deleteBackupState()), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    createBackupFolder() {
        return this.setObjectNotExistsAsync('backup', {
            type: 'folder',
            common: {
                name: 'backup',
                read: true,
            },
            native: {
                id: 'backup',
            },
        });
    }
    createBackupStatusFolder() {
        return this.setObjectNotExistsAsync('backup.backupStatus', {
            type: 'folder',
            common: {
                name: 'backupStatus',
                read: true,
            },
            native: {
                id: 'backup.backupStatus',
            },
        });
    }
    createRestoreStatusFolder() {
        return this.setObjectNotExistsAsync('backup.restoreStatus', {
            type: 'folder',
            common: {
                name: 'restoreStatus',
                read: true,
            },
            native: {
                id: 'backup.restoreStatus',
            },
        });
    }
    createBackupState() {
        const id = 'backup.createBackup';
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: 'Create Backup',
                type: 'boolean',
                role: 'switch',
                read: false,
                write: true,
            },
            native: {
                id: id,
            },
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, { val: false, ack: true })));
    }
    deleteBackupState() {
        const id = 'backup.deleteBackup';
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: 'Delete backup file on Controller',
                type: 'boolean',
                role: 'switch',
                read: false,
                write: true,
            },
            native: {
                id: id,
            },
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, { val: false, ack: true })));
    }
    addState(prefix, type, key, value) {
        const id = `${prefix}.${key}`;
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole(type, key, value),
                read: true,
                write: false,
                unit: bshb_definition_1.BshbDefinition.determineUnit(type, key),
                states: bshb_definition_1.BshbDefinition.determineStates(type, key),
            },
            native: {
                id: id,
            },
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, { val: value, ack: true })));
    }
    async ensureDirectoryExists(directoryPath) {
        try {
            await fs_1.promises.access(directoryPath, fs_1.promises.constants.F_OK);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                await fs_1.promises.mkdir(directoryPath, { recursive: true });
            }
            else {
                throw error;
            }
        }
    }
    createFileName(fileName) {
        if (fileName) {
            return fileName;
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const day = String(now.getDate()).padStart(2, '0');
        return `shc-${year}${month}${day}.home`;
    }
}
exports.BshbBackupHandler = BshbBackupHandler;
//# sourceMappingURL=bshb-backup-handler.js.map
