import {BshbHandler} from './bshb-handler';
import {concat, Observable, switchMap, tap} from 'rxjs';

export class BshbIntrusionDetection extends BshbHandler {
    private readonly folderName: string = 'intrusionDetectionControl'
    private intrusionDetectionControlRegex = /bshb\.\d+\.intrusionDetectionControl\.(.*)/;


    handleBshcUpdate(resultEntry: any): boolean {
        // We do not update information we only have write only switches here
        return false;
    }

    handleDetection(): Observable<void> {
        this.bshb.log.info('Start detecting intrusion detection system...');

        return this.detectIntrusionDetectionSystem().pipe(tap({
            complete: () => this.bshb.log.info('Detecting intrusion detection system finished')
        }));
    }

    sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        const match = this.intrusionDetectionControlRegex.exec(id);

        if (match) {
            this.bshb.log.debug(`Found intrusionDetectionControl trigger with id=${match[1]} and value=${state.val}`);

            if (state.val) {
                const control = match[1];

                let command;
                switch (control) {
                    case 'fullProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(0,{timeout: this.long_timeout});
                        break;
                    case 'partialProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(1,{timeout: this.long_timeout});
                        break;
                    case 'individualProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(2,{timeout: this.long_timeout});
                        break;
                    case 'disarmProtection':
                        command = this.getBshcClient().disarmIntrusionDetectionSystem({timeout: this.long_timeout});
                        break;
                    case 'muteProtection':
                        command = this.getBshcClient().muteIntrusionDetectionSystem({timeout: this.long_timeout});
                        break;
                    default:
                        return false;
                }

                command.subscribe(() => {
                    this.bshb.log.info(`intrusionDetectionControl with id=${match[1]} triggered`);
                    this.bshb.setState(id, {val: false, ack: true});
                }, error => {
                    this.bshb.log.warn(`Could not send trigger for intrusionDetectionControl with id=${match[1]} and value=${state.val}: ` + error)
                });
            }
            return true;
        }

        return false;
    }

    private detectIntrusionDetectionSystem(): Observable<void> {
        return this.setObjectNotExistsAsync(this.folderName, {
            type: 'folder',
            common: {
                name: 'Intrusion Detection Control',
                read: true
            },
            native: {
                id: this.folderName
            },
        }).pipe(
            switchMap(() => {
                const idPrefix = this.folderName + '.';

                const observables = [];

                // full
                observables.push(this.addProfile(idPrefix, 'fullProtection', 'Full Protection'));
                // partial
                observables.push(this.addProfile(idPrefix, 'partialProtection', 'Partial Protection'));
                // individual
                observables.push(this.addProfile(idPrefix, 'individualProtection', 'Individual Protection'));
                // individual
                observables.push(this.addProfile(idPrefix, 'individualProtection', 'Individual Protection'));
                // disarm
                observables.push(this.addProfile(idPrefix, 'disarmProtection', 'Disarm Protection'));
                // mute
                observables.push(this.addProfile(idPrefix, 'muteProtection', 'Mute Protection'));

                return concat(...observables);
            })
        );
    }

    private addProfile(idPrefix: string, id: string, name: string) {
        return new Observable<void>(subscriber => {
            this.bshb.setObjectNotExists(idPrefix + id, {
                type: 'state',
                common: {
                    name: name,
                    type: 'boolean',
                    role: 'switch',
                    read: false,
                    write: true
                },
                native: {
                    id: idPrefix + id,
                    name: name
                },
            }, () => {
                this.bshb.setState(idPrefix + id, {val: false, ack: true});

                subscriber.next();
                subscriber.complete();
            });
        });
    }
}