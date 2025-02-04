import { BshbHandler } from './bshb-handler';
import { concat, Observable, of, tap } from 'rxjs';
import { BshbResponse } from 'bosch-smart-home-bridge';
import { switchMap } from 'rxjs/operators';

export class BshbOpenDoorWindowHandler extends BshbHandler {
  public handleDetection(): Observable<void> {
    return this.detectOpenDoorsAndWindows().pipe(
      tap({
        subscribe: () => this.bshb.log.info('Start detecting open doors/windows...'),
        finalize: () => this.bshb.log.info('Detecting open doors/windows finished'),
      })
    );
  }

  public handleBshcUpdate(resultEntry: any): boolean {
    // we do something in case the state of a shutter contact changed
    const condition1 = resultEntry['@type'] === 'DeviceServiceData' && resultEntry.id === 'ShutterContact';

    // setting of device changed. Probably the profile. So we refresh
    const condition2 =
      resultEntry['@type'] === 'device' &&
      Array.isArray(resultEntry.deviceServiceIds) &&
      (resultEntry.deviceServiceIds as string[]).includes('ShutterContact');

    if (condition1 || condition2) {
      this.bshb.log.debug('Updating open doors/windows state...');

      this.detectOpenDoorsAndWindows().subscribe(
        this.handleBshcUpdateError(`condition1=${condition1}, condition2=${condition2}`)
      );
      return true;
    }
    return false;
  }

  public sendUpdateToBshc(_id: string, _state: ioBroker.State): Observable<boolean> {
    // not needed
    return of(false);
  }

  private detectOpenDoorsAndWindows(): Observable<void> {
    return this.getBshcClient()
      .getOpenWindows({ timeout: this.long_timeout })
      .pipe(
        tap(() =>
          this.setObjectNotExistsAsync('openDoorsAndWindows', {
            type: 'folder',
            common: {
              name: 'Open Doors / Windows',
              read: true,
            },
            native: {
              id: 'openDoorsAndWindows',
            },
          })
        ),
        switchMap(result => {
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

          return concat(...observables);
        })
      );
  }

  private createGroup(idPrefix: string, id: string, name: string): Observable<void> {
    return this.setObjectNotExistsAsync(idPrefix + id, {
      type: 'folder',
      common: {
        name: name,
        read: true,
      },
      native: {
        id: idPrefix + id,
        name: id,
      },
    }).pipe(switchMap(() => of(undefined)));
  }

  private setList(
    idPrefix: string,
    id: string,
    key: string,
    name: string,
    result: BshbResponse<any>
  ): Observable<void> {
    return this.setListState(idPrefix, id, key, name, result).pipe(
      switchMap(() => this.setListCount(idPrefix, id, key, name, result))
    );
  }

  private setListState(
    idPrefix: string,
    id: string,
    key: string,
    name: string,
    result: BshbResponse<any>
  ): Observable<void> {
    const list: string[] = [];

    this.getElements(result, key).forEach((val: any) => {
      list.push(val.name);
    });

    return of(list).pipe(
      switchMap(() =>
        this.setObjectNotExistsAsync(idPrefix + id, {
          type: 'state',
          common: {
            name: name,
            type: 'array',
            role: 'list',
            read: true,
            write: false,
          },
          native: {
            id: idPrefix + id,
            name: id,
          },
        })
      ),
      tap(() =>
        this.bshb.setState(idPrefix + id, {
          val: this.mapValueToStorage(list),
          ack: true,
        })
      ),
      switchMap(() => of(undefined))
    );
  }

  private setListCount(
    idPrefix: string,
    id: string,
    key: string,
    name: string,
    result: BshbResponse<any>
  ): Observable<void> {
    return this.setObjectNotExistsAsync(idPrefix + id + 'Count', {
      type: 'state',
      common: {
        name: name + ' count',
        type: 'number',
        role: 'value',
        read: true,
        write: false,
      },
      native: {
        id: idPrefix + id + 'Count',
        name: id + 'Count',
      },
    }).pipe(
      tap(() =>
        this.bshb.setState(idPrefix + id + 'Count', {
          val: this.getElements(result, key).length,
          ack: true,
        })
      ),
      switchMap(() => of(undefined))
    );
  }

  private getElements(result: BshbResponse<any>, key: string): any[] {
    if (key.startsWith('--all')) {
      const groupPrefix = BshbOpenDoorWindowHandler.getGroupPrefix(key);
      let list: any[] = [];
      Object.keys(result.parsedResponse).forEach(itemKey => {
        if (itemKey.startsWith(groupPrefix)) {
          list = list.concat(result.parsedResponse[itemKey]);
        }
      });

      return list;
    } else {
      if (typeof result.parsedResponse[key] === 'undefined' || result.parsedResponse[key] === null) {
        this.bshb.log.error(`Could not find open windows/doors with key=${key}`);
        return [];
      } else {
        return result.parsedResponse[key];
      }
    }
  }

  private setAllState(idPrefix: string, result: BshbResponse<any>): Observable<void> {
    return this.setObjectNotExistsAsync(idPrefix + 'raw', {
      type: 'state',
      common: {
        name: 'Raw Data from BSHC',
        type: 'object',
        role: 'state',
        read: true,
        write: false,
      },
      native: {
        id: idPrefix + 'raw',
        name: 'openDoorsAndWindows',
      },
    }).pipe(
      tap(() =>
        this.bshb.setState(idPrefix + 'raw', {
          val: this.mapValueToStorage(result.parsedResponse),
          ack: true,
        })
      ),
      switchMap(() => of(undefined))
    );
  }

  private static getGroupPrefix(key: string): string {
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

  name(): string {
    return 'OpenDoorWindowHandler';
  }
}
