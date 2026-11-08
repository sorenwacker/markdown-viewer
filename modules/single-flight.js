// Share one in-flight call per key: a second call for a key whose first call has
// not settled yet gets the same promise instead of starting the work again.
// fn starts synchronously, as a direct async call would.
export function createSingleFlight() {
  const pending = new Map();
  return function run(key, fn) {
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => fn())().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
