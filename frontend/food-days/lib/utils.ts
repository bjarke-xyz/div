/* eslint-disable @typescript-eslint/no-explicit-any */
export const fetcher = <T>(...args: any[]) =>
  // eslint-disable-next-line prefer-spread
  fetch.apply(null, args as any).then((res) => res.json() as T);
