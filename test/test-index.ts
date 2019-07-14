import * as assert from 'assert';
import * as lib from '../src/index';

describe('all', () => {
  async function* shoot(n: number, err?: boolean) {
    while (n > 0) {
      yield n;
      n--;
      if (err) {
        throw new Error('proxy');
      }
    }
  }

  it('gathers some', async () => {
    assert.deepStrictEqual(await lib.all(shoot(5)), [5, 4, 3, 2, 1]);
  });

  it('gathers none', async () => {
    assert.deepStrictEqual(await lib.all(shoot(0)), []);
  });

  it('proxies errors', async () => {
    await assert.rejects(lib.all(shoot(5, true)), new Error('proxy'));
  });
});

describe('allUntilError', () => {
  async function* shoot(n: number, err = -1) {
    if (err === n) {
      throw new Error(`proxy${n}`);
    }
    while (n > 0) {
      yield n;
      n--;
      if (err === n) {
        throw new Error(`proxy${n}`);
      }
    }
  }

  it('gathers some', async () => {
    assert.deepStrictEqual(await lib.allUntilError(shoot(5)), [
      { item: 5 },
      { item: 4 },
      { item: 3 },
      { item: 2 },
      { item: 1 },
    ]);
  });

  it('gathers none', async () => {
    assert.deepStrictEqual(await lib.allUntilError(shoot(0)), []);
  });

  it('proxies errors after items', async () => {
    assert.deepStrictEqual(await lib.allUntilError(shoot(5, 3)), [
      { item: 5 },
      { item: 4 },
      { error: new Error('proxy3') },
    ]);
  });

  it('proxies errors before items', async () => {
    assert.deepStrictEqual(await lib.allUntilError(shoot(5, 5)), [
      { error: new Error('proxy5') },
    ]);
  });
});

describe('paginate', () => {
  class BasicPaginator {
    max: number;
    whenThrow: number;
    timesCalled = 0;
    tokens: Array<number | undefined> = [];
    constructor(max = 20, whenThrow = 50) {
      this.max = max;
      this.whenThrow = whenThrow;
    }
    func = async (token?: number) => {
      const t = token || 0;
      this.tokens.push(token);
      this.timesCalled++;
      if (t === this.whenThrow) {
        throw new Error(`proxy${token}`);
      }
      return {
        next: t >= this.max ? undefined : t + 10,
        page: [t, t + 1, t + 2, t + 3],
      };
    };
  }

  it('works with no maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(lib.paginate<number, number>(o.func));
    assert.deepStrictEqual(o.timesCalled, 3);
    assert.deepStrictEqual(o.tokens, [undefined, 10, 20]);
    assert.deepStrictEqual(actual, [
      0,
      1,
      2,
      3,
      10,
      11,
      12,
      13,
      20,
      21,
      22,
      23,
    ]);
  });

  it('works with exact multi-page maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 8)
    );
    assert.deepStrictEqual(o.timesCalled, 2);
    assert.deepStrictEqual(o.tokens, [undefined, 10]);
    assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13]);
  });

  it('proxies errors thrown before items', async () => {
    const o = new BasicPaginator(50, 0);
    const actual = await lib.allUntilError(
      lib.paginate<number, number>(o.func, undefined, 4)
    );
    assert.deepStrictEqual(o.timesCalled, 1);
    assert.deepStrictEqual(o.tokens, [undefined]);
    assert.deepStrictEqual(actual, [{ error: new Error('proxyundefined') }]);
  });

  it('proxies errors after one page but before maxcount', async () => {
    const o = new BasicPaginator(50, 10);
    const actual = await lib.allUntilError(
      lib.paginate<number, number>(o.func, undefined, 7)
    );
    assert.deepStrictEqual(o.timesCalled, 2);
    assert.deepStrictEqual(o.tokens, [undefined, 10]);
    assert.deepStrictEqual(actual, [
      { item: 0 },
      { item: 1 },
      { item: 2 },
      { item: 3 },
      { error: new Error('proxy10') },
    ]);
  });

  it('works with exact one-page maxCount', async () => {
    const o = new BasicPaginator(50, 10);
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 4)
    );
    assert.deepStrictEqual(o.timesCalled, 1);
    assert.deepStrictEqual(o.tokens, [undefined]);
    assert.deepStrictEqual(actual, [0, 1, 2, 3]);
  });

  it('works with exact all-page maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 12)
    );
    assert.deepStrictEqual(o.timesCalled, 3);
    assert.deepStrictEqual(o.tokens, [undefined, 10, 20]);
    assert.deepStrictEqual(actual, [
      0,
      1,
      2,
      3,
      10,
      11,
      12,
      13,
      20,
      21,
      22,
      23,
    ]);
  });

  it('works with above all-page maxCount', async () => {
    const o = new BasicPaginator(20, 30);
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 15)
    );
    assert.deepStrictEqual(o.timesCalled, 3);
    assert.deepStrictEqual(o.tokens, [undefined, 10, 20]);
    assert.deepStrictEqual(actual, [
      0,
      1,
      2,
      3,
      10,
      11,
      12,
      13,
      20,
      21,
      22,
      23,
    ]);
  });

  it('works with partial one-page maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 2)
    );
    assert.deepStrictEqual(o.timesCalled, 1);
    assert.deepStrictEqual(o.tokens, [undefined]);
    assert.deepStrictEqual(actual, [0, 1]);
  });

  it('works with partial multi-page maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 11)
    );
    assert.deepStrictEqual(o.timesCalled, 3);
    assert.deepStrictEqual(o.tokens, [undefined, 10, 20]);
    assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22]);
  });

  it('works with partial multi-page maxCount', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(
      lib.paginate<number, number>(o.func, undefined, 11)
    );
    assert.deepStrictEqual(o.timesCalled, 3);
    assert.deepStrictEqual(o.tokens, [undefined, 10, 20]);
    assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22]);
  });

  it('works with initial token', async () => {
    const o = new BasicPaginator();
    const actual = await lib.all(lib.paginate<number, number>(o.func, 3, 7));
    assert.deepStrictEqual(o.timesCalled, 2);
    assert.deepStrictEqual(o.tokens, [3, 13]);
    assert.deepStrictEqual(actual, [
      0 + 3,
      1 + 3,
      2 + 3,
      3 + 3,
      10 + 3,
      11 + 3,
      12 + 3,
    ]);
  });
});
