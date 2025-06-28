import { delay, mergeMap, MonoTypeOperatorFunction, of, pipe, tap } from 'rxjs';
import { Bshb } from './main';

export const rateLimit = <T>(interval: number, bshb: Bshb): MonoTypeOperatorFunction<T> => {
  let last = -1;

  return pipe(
    mergeMap((v: T) => {
      let result = of(v).pipe(tap(() => (last = Date.now())));

      if (interval === 0) {
        bshb.log.silly('rateLimit disabled.');
        // Disabled
      } else {
        const now = Date.now();

        if (last !== -1 && now - last < interval) {
          const newDelay = interval - (now - last);
          bshb.log.silly(`delay request due to rate limit for ${newDelay} ms.`);
          result = of(v)
            .pipe(delay(newDelay))
            .pipe(tap(() => (last = Date.now())));
        }
      }
      return result;
    })
  );
};
