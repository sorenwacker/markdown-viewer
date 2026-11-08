const { test, expect } = require('@playwright/test');

// createTab goes through a single-flight wrapper so two quick opens of the same
// file, which both pass the duplicate check before the file is read, share one
// open instead of creating two tabs.
test.describe('createSingleFlight', () => {
  let createSingleFlight;

  test.beforeAll(async () => {
    ({ createSingleFlight } = await import('../modules/single-flight.js'));
  });

  test('concurrent calls for one key run the work once and share its result', async () => {
    const run = createSingleFlight();
    let calls = 0;
    let finish;
    const work = () => {
      calls++;
      return new Promise(resolve => { finish = resolve; });
    };
    const first = run('/docs/a.md', work);
    const second = run('/docs/a.md', work);
    expect(second).toBe(first);
    finish('tab-1');
    expect(await Promise.all([first, second])).toEqual(['tab-1', 'tab-1']);
    expect(calls).toBe(1);
  });

  test('different keys run independently', async () => {
    const run = createSingleFlight();
    const results = await Promise.all([run('a', async () => 'A'), run('b', async () => 'B')]);
    expect(results).toEqual(['A', 'B']);
  });

  test('a key can run again once its call has settled, even after a failure', async () => {
    const run = createSingleFlight();
    await expect(run('a', async () => { throw new Error('read failed'); })).rejects.toThrow('read failed');
    expect(await run('a', async () => 'retried')).toBe('retried');
  });

  test('the work starts synchronously', () => {
    const run = createSingleFlight();
    let started = false;
    run('a', async () => { started = true; });
    expect(started).toBe(true);
  });
});
