import * as assert from 'assert';
import * as lib from '../src/index';

describe('#all()', () => {
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

describe('#allUntilError()', () => {
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

describe('#paginate()', () => {
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

  class ProgressPaginator {
    max: number;
    whenThrow: number;
    estMax: number;
    timesCalled = 0;
    tokens: Array<number | undefined> = [];
    constructor(max = 20, whenThrow = 50, estMax = 100) {
      this.max = max;
      this.whenThrow = whenThrow;
      this.estMax = estMax;
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
        estimatedTotal: this.estMax,
      };
    };
  }

  describe('with no reportProgressFn', () => {
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

    it('ignores returned estimated totals', async () => {
      const o = new ProgressPaginator(undefined, undefined, 7);
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

  describe('with a reportProgressFn', () => {
    class ProgressTracker {
      readonly reports: Array<[number, number?]>;
      constructor() {
        this.reports = [];
      }
      func = async (yielded: number, estimatedTotal?: number) => {
        this.reports.push([yielded, estimatedTotal]);
      };
    }
    describe('without an estimated total', () => {
      it('works with no maxCount', async () => {
        const o = new BasicPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, undefined, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, undefined],
          [4, undefined],
          [4, undefined],
          [8, undefined],
          [8, undefined],
          [12, undefined],
        ]);
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
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 8, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 8], [4, 8], [4, 8], [8, 8]]);
        assert.deepStrictEqual(o.timesCalled, 2);
        assert.deepStrictEqual(o.tokens, [undefined, 10]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13]);
      });

      it('proxies errors thrown before items', async () => {
        const o = new BasicPaginator(50, 0);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 4)
        );
        assert.deepStrictEqual(pt.reports, []);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [
          { error: new Error('proxyundefined') },
        ]);
      });

      it('proxies errors after one page but before maxcount', async () => {
        const o = new BasicPaginator(50, 10);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 7], [4, 7]]);
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
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 4, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 4], [4, 4]]);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3]);
      });

      it('works with exact all-page maxCount', async () => {
        const o = new BasicPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 12, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 12],
          [4, 12],
          [4, 12],
          [8, 12],
          [8, 12],
          [12, 12],
        ]);
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
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 15, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 15],
          [4, 15],
          [4, 15],
          [8, 15],
          [8, 15],
          [12, 15],
        ]);
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
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 2, pt.func)
        );

        assert.deepStrictEqual(pt.reports, [[0, 2], [2, 2]]);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [0, 1]);
      });

      it('works with partial multi-page maxCount', async () => {
        const o = new BasicPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 11, pt.func)
        );

        assert.deepStrictEqual(pt.reports, [
          [0, 11],
          [4, 11],
          [4, 11],
          [8, 11],
          [8, 11],
          [11, 11],
        ]);
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
        ]);
      });

      it('works with initial token', async () => {
        const o = new BasicPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, 3, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 7], [4, 7], [4, 7], [7, 7]]);
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

    describe('with a high estimated total', () => {
      it('works with no maxCount', async () => {
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, undefined, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 100],
          [4, 100],
          [4, 100],
          [8, 100],
          [8, 100],
          [12, 100],
        ]);
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
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 8, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 8], [4, 8], [4, 8], [8, 8]]);
        assert.deepStrictEqual(o.timesCalled, 2);
        assert.deepStrictEqual(o.tokens, [undefined, 10]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13]);
      });

      it('proxies errors thrown before items', async () => {
        const o = new ProgressPaginator(50, 0);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 4)
        );
        assert.deepStrictEqual(pt.reports, []);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [
          { error: new Error('proxyundefined') },
        ]);
      });

      it('proxies errors after one page but before maxcount', async () => {
        const o = new ProgressPaginator(50, 10);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 7], [4, 7]]);
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
        const o = new ProgressPaginator(50, 10);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 4, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 4], [4, 4]]);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3]);
      });

      it('works with exact all-page maxCount', async () => {
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 12, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 12],
          [4, 12],
          [4, 12],
          [8, 12],
          [8, 12],
          [12, 12],
        ]);
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
        const o = new ProgressPaginator(20, 30);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 15, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 15],
          [4, 15],
          [4, 15],
          [8, 15],
          [8, 15],
          [12, 15],
        ]);
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
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 2, pt.func)
        );

        assert.deepStrictEqual(pt.reports, [[0, 2], [2, 2]]);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [0, 1]);
      });

      it('works with partial multi-page maxCount', async () => {
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 11, pt.func)
        );

        assert.deepStrictEqual(pt.reports, [
          [0, 11],
          [4, 11],
          [4, 11],
          [8, 11],
          [8, 11],
          [11, 11],
        ]);
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
        ]);
      });

      it('works with initial token', async () => {
        const o = new ProgressPaginator();
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, 3, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 7], [4, 7], [4, 7], [7, 7]]);
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

    describe('with a low estimated total', () => {
      it('works with no maxCount', async () => {
        const o = new ProgressPaginator(undefined, undefined, 2);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, undefined, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [
          [0, 2],
          [4, 2],
          [4, 2],
          [8, 2],
          [8, 2],
          [12, 2],
        ]);
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
        const o = new ProgressPaginator(undefined, undefined, 2);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 8, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 2], [4, 2], [4, 2], [8, 2]]);
        assert.deepStrictEqual(o.timesCalled, 2);
        assert.deepStrictEqual(o.tokens, [undefined, 10]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3, 10, 11, 12, 13]);
      });

      it('proxies errors thrown before items', async () => {
        const o = new ProgressPaginator(50, 0, 2);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 4)
        );
        assert.deepStrictEqual(pt.reports, []);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [
          { error: new Error('proxyundefined') },
        ]);
      });

      it('proxies errors after one page but before maxcount', async () => {
        const o = new ProgressPaginator(50, 10, 5);
        const pt = new ProgressTracker();
        const actual = await lib.allUntilError(
          lib.paginate<number, number>(o.func, undefined, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 5], [4, 5]]);
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
        const o = new ProgressPaginator(50, 10, 3);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, undefined, 4, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 3], [4, 3]]);
        assert.deepStrictEqual(o.timesCalled, 1);
        assert.deepStrictEqual(o.tokens, [undefined]);
        assert.deepStrictEqual(actual, [0, 1, 2, 3]);
      });

      it('works with initial token', async () => {
        const o = new ProgressPaginator(undefined, undefined, 5);
        const pt = new ProgressTracker();
        const actual = await lib.all(
          lib.paginate<number, number>(o.func, 3, 7, pt.func)
        );
        assert.deepStrictEqual(pt.reports, [[0, 5], [4, 5], [4, 5], [7, 5]]);
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
  });
});
