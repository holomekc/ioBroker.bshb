import { BshbHandler } from './bshb-handler';
import { from, mergeMap, Observable, of, tap } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BshbDefinition } from '../../bshb-definition';

export class BshbRoomHandler extends BshbHandler {
  private cachedStates = new Map<string, any>();

  handleDetection(): Observable<void> {
    return this.detectRooms().pipe(
      tap({
        subscribe: () => this.bshb.log.info('Start detecting rooms...'),
        finalize: () => this.bshb.log.info('Detecting rooms finished'),
      })
    );
  }

  handleBshcUpdate(resultEntry: any): boolean {
    // {"iconId":"icon_room_living_room","extProperties":{"humidity":"81.5"},"@type":"room","name":"Wohnzimmer","id":"hz_2"}
    if (resultEntry['@type'] === 'room') {
      const idPrefix = `rooms.${resultEntry.id}`;

      Object.keys(resultEntry).forEach(key => {
        const id = `${idPrefix}.${key}`;

        if (key === 'extProperties') {
          this.handleExtPropertiesUpdate(idPrefix, resultEntry[key]);
        } else {
          this.handleDefaultUpdate(idPrefix, id, resultEntry, key);
        }
      });
    }
    return false;
  }

  private handleDefaultUpdate(roomId: string, id: string, resultEntry: any, key: string) {
    from(this.bshb.getObjectAsync(id))
      .pipe(
        switchMap(obj => {
          if (obj) {
            this.bshb.setState(id, {
              val: this.mapValueToStorage(resultEntry[key]),
              ack: true,
            });
            return of(undefined);
          } else {
            return this.addRoom(resultEntry);
          }
        })
      )
      .subscribe(this.handleBshcUpdateError(`id=${roomId}, key=${key}`));
  }

  private handleExtPropertiesUpdate(roomId: string, extProperties: any) {
    from(Object.keys(extProperties)).pipe(
      tap(key => this.handleDefaultUpdate(roomId, `${roomId}.${key}`, extProperties, key))
    );
  }

  sendUpdateToBshc(_id: string, _state: ioBroker.State): Observable<boolean> {
    return of(false);
  }

  private detectRooms(): Observable<void> {
    return this.setObjectNotExistsAsync('rooms', {
      type: 'folder',
      common: {
        name: 'Rooms',
        read: true,
      },
      native: {},
    }).pipe(
      switchMap(() => this.getBshcClient().getRooms({ timeout: this.long_timeout })),
      mergeMap(response => from(response.parsedResponse)),
      mergeMap(room => this.addRoom(room)),
      switchMap(() => of(undefined))
    );
  }

  private addRoom(room: any): Observable<any> {
    // Cache room: hz_7 with: {"@type":"room","id":"hz_7","iconId":"icon_room_basement","name":"Test2"}
    // Cache room: hz_2 with: {"@type":"room","id":"hz_2","iconId":"icon_room_living_room","name":"Wohnzimmer","extProperties":{"humidity":"56.76"}}
    return this.setObjectNotExistsAsync(`rooms.${room.id}`, {
      type: 'folder',
      common: {
        name: room.name,
        read: true,
      },
      native: {},
    }).pipe(
      tap(() => this.addRoomEnum(room.name, 'rooms', room.id)),
      mergeMap(() => from(Object.keys(room))),
      mergeMap(key => this.importState(key, room))
    );
  }

  private importState(key: string, room: any): Observable<any> {
    if (key === '@type' || key === 'id') {
      return of(undefined);
    }

    const id = `rooms.${room.id}.${key}`;
    const value = room[key];
    this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
      id: room.id,
      key: key,
    });

    if (key === 'extProperties') {
      return from(Object.keys(room[key])).pipe(mergeMap(key => this.addExtProperties(key, room)));
    } else {
      return this.setObjectNotExistsAsync(id, {
        type: 'state',
        common: {
          name: key,
          type: BshbDefinition.determineType(value),
          role: BshbDefinition.determineRole('room', key, value),
          unit: BshbDefinition.determineUnit('room', key),
          read: true,
          // TODO: Not sure yet how to write room values.
          write: false,
          // write: BshbDefinition.determineWrite('room', key)
        },
        native: {},
      }).pipe(
        switchMap(() => from(this.bshb.getStateAsync(id))),
        switchMap(state => this.setInitialStateValueIfNotSet(id, state, value))
      );
    }
  }

  private addExtProperties(key: string, room: any): Observable<any> {
    const id = `rooms.${room.id}.${key}`;
    const value = room.extProperties[key];

    return this.setObjectNotExistsAsync(id, {
      type: 'state',
      common: {
        name: key,
        type: BshbDefinition.determineType(value),
        role: BshbDefinition.determineRole('roomExtProperties', key, value),
        unit: BshbDefinition.determineUnit('roomExtProperties', key),
        read: true,
        // TODO: Not sure yet how to write room values.
        write: false,
        // write: BshbDefinition.determineWrite('roomExtProperties', key)
      },
      native: {},
    }).pipe(
      switchMap(() => from(this.bshb.getStateAsync(id))),
      switchMap(state => this.setInitialStateValueIfNotSet(id, state, value))
    );
  }

  name(): string {
    return 'roomHandler';
  }
}
