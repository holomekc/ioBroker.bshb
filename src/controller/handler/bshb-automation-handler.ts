import { BshbHandler } from './bshb-handler';
import { catchError, delay, from, last, map, mergeMap, Observable, of, switchMap, tap } from 'rxjs';

/**
 * This handler is used to detect automations of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export class BshbAutomationHandler extends BshbHandler {
  private automationRegex = /bshb\.\d+\.automations\.(.+?)\.(.+)/;

  public handleDetection(): Observable<void> {
    return this.detectAutomations().pipe(
      tap({
        subscribe: () => this.bshb.log.info('Start detecting automations...'),
        finalize: () => this.bshb.log.info('Detecting automations finished'),
      })
    );
  }

  public handleBshcUpdate(resultEntry: any): boolean {
    if (resultEntry['@type'] === 'automationRule') {
      this.detectAutomations().subscribe();
      return true;
    }
    return false;
  }

  public sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
    const match = this.automationRegex.exec(id);

    let result = of(false);

    if (match) {
      const automationId = match[1];
      const key = match[2];

      this.bshb.log.debug(`Found automation with id=${automationId}, key=${key} and value=${state.val}`);

      if (key === 'trigger') {
        result = this.getBshcClient()
          .triggerAutomation(automationId, { timeout: this.long_timeout })
          .pipe(
            delay(1000),
            switchMap(() =>
              from(
                this.bshb.setState(id, {
                  val: false,
                  ack: true,
                })
              )
            ),
            tap(
              this.handleBshcSendError(
                `id=${automationId}, value=${state.val}, key=${key}, automationId=${automationId}`
              )
            ),
            map(() => true)
          );
      } else {
        const idPrefix = 'automations.' + automationId;
        const data: any = {};
        data['@type'] = 'automationRule';
        data.id = automationId;

        result = from(
          this.addAutomationValue(idPrefix, 'enabled', data)
            .then(() => this.addAutomationValue(idPrefix, 'name', data))
            .then(() => this.addAutomationValue(idPrefix, 'automationConditions', data, val => JSON.parse(val)))
            .then(() => this.addAutomationValue(idPrefix, 'automationTriggers', data, val => JSON.parse(val)))
            .then(() => this.addAutomationValue(idPrefix, 'automationActions', data, val => JSON.parse(val)))
            .then(() => this.addAutomationValue(idPrefix, 'conditionLogicalOp', data))
        ).pipe(
          switchMap(() =>
            this.getBshcClient().setAutomation(automationId, data, {
              timeout: this.long_timeout,
            })
          ),
          tap(this.handleBshcSendError(`id=${automationId}, value=${state.val}, data=${JSON.stringify(data)}`)),
          map(() => true)
        );
      }
    }

    return result;
  }

  private async addAutomationValue(idPrefix: string, key: string, data: any, mapFnc?: (val: any) => any) {
    const state = await this.bshb.getStateAsync(`${idPrefix}.${key}`);
    if (mapFnc) {
      return (data[key] = mapFnc(state!.val));
    } else {
      return (data[key] = state!.val);
    }
  }

  private detectAutomations(): Observable<void> {
    return this.setObjectNotExistsAsync('automations', {
      type: 'folder',
      common: {
        name: 'automations',
        read: true,
      },
      native: {
        id: 'automations',
      },
    }).pipe(
      switchMap(() =>
        this.getBshcClient().getAutomations(undefined, {
          timeout: this.long_timeout,
        })
      ),
      switchMap(response =>
        this.deleteMissingAutomations(response.parsedResponse).pipe(
          last(undefined, void 0),
          switchMap(() => from(response.parsedResponse))
        )
      ),
      mergeMap(automation => {
        this.bshb.log.debug(`Found automation ${automation.id}, ${automation.name || 'Unknown'}`);
        const id = 'automations.' + automation.id;
        const automationName = automation.name || automation.id || 'Unknown';

        // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
        return from(
          this.bshb.setObject(id, {
            type: 'folder',
            common: {
              name: automationName,
              type: 'boolean',
              role: 'switch',
              write: true,
              read: false,
            },
            native: {
              id: automation.id,
              name: automationName,
            },
          })
        ).pipe(
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.enabled`, {
                type: 'state',
                common: {
                  name: 'enabled',
                  type: 'boolean',
                  role: 'switch',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.enabled`,
                  name: 'enabled',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.enabled`, {
              val: automation.enabled,
              ack: true,
            })
          ),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.name`, {
                type: 'state',
                common: {
                  name: 'name',
                  type: 'string',
                  role: 'text',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.name`,
                  name: 'name',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.name`, {
              val: automation.name,
              ack: true,
            })
          ),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.trigger`, {
                type: 'state',
                common: {
                  name: 'trigger',
                  type: 'boolean',
                  role: 'switch',
                  write: true,
                  read: false,
                },
                native: {
                  id: `${id}.trigger`,
                  name: 'trigger',
                },
              })
            )
          ),
          tap(() => this.bshb.setState(`${id}.trigger`, { val: false, ack: true })),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.automationConditions`, {
                type: 'state',
                common: {
                  name: 'automationConditions',
                  type: 'array',
                  role: 'list',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.automationConditions`,
                  name: 'automationConditions',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.automationConditions`, {
              val: this.mapValueToStorage(automation.automationConditions),
              ack: true,
            })
          ),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.automationTriggers`, {
                type: 'state',
                common: {
                  name: 'automationTriggers',
                  type: 'array',
                  role: 'list',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.automationTriggers`,
                  name: 'automationTriggers',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.automationTriggers`, {
              val: this.mapValueToStorage(automation.automationTriggers),
              ack: true,
            })
          ),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.automationActions`, {
                type: 'state',
                common: {
                  name: 'automationActions',
                  type: 'array',
                  role: 'list',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.automationActions`,
                  name: 'automationActions',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.automationActions`, {
              val: this.mapValueToStorage(automation.automationActions),
              ack: true,
            })
          ),
          switchMap(() =>
            from(
              this.bshb.setObject(`${id}.conditionLogicalOp`, {
                type: 'state',
                common: {
                  name: 'conditionLogicalOp',
                  type: 'string',
                  role: 'text',
                  write: true,
                  read: true,
                },
                native: {
                  id: `${id}.conditionLogicalOp`,
                  name: 'conditionLogicalOp',
                },
              })
            )
          ),
          tap(() =>
            this.bshb.setState(`${id}.conditionLogicalOp`, {
              val: automation.conditionLogicalOp,
              ack: true,
            })
          )
        );
      }),
      switchMap(() => of(undefined))
    );
  }

  private deleteMissingAutomations(automations: any[]): Observable<void> {
    return from(this.bshb.getStatesOfAsync('automations', '')).pipe(
      switchMap(objects => from(objects)),
      switchMap(object => {
        let found = false;
        for (let i = 0; i < automations.length; i++) {
          if (object.native.id === automations[i].id) {
            // found automation
            found = true;
            break;
          }
        }

        if (!found) {
          return from(this.bshb.delObjectAsync(`automations.${object.native.id}`)).pipe(
            tap(() =>
              this.bshb.log.info(`automation with id=${object.native.id} removed because it does not exist anymore.`)
            ),
            catchError(err => {
              this.bshb.log.error(`Could not delete automation with id=${object.native.id} because: ` + err);
              return of(undefined);
            })
          );
        } else {
          return of(undefined);
        }
      })
    );
  }

  name(): string {
    return 'automationHandler';
  }
}
