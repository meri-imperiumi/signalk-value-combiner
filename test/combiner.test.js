const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const combiner = require('../plugin/combiner');

const noopApp = { debug: () => {} };

describe('Combiner', () => {
  it('should return empty outputs for empty input', () => {
    const { outputs, meta } = combiner({}, {
      paths: [],
    }, noopApp);
    assert.equal(Array.isArray(outputs), true);
    assert.equal(outputs.length, 0);
    assert.deepEqual(meta, []);
  });
  it('should return a sum for matched paths', () => {
    const { outputs, meta } = combiner({
      'environment.outside.temperature': 10,
      'environment.inside.temperature': 7,
    }, {
      paths: [
        {
          operation: 'addition',
          input: [
            'environment.outside.temperature',
            'environment.inside.temperature',
          ],
          output: 'environment.total.temperature',
        },
      ],
    }, noopApp);
    assert.equal(Array.isArray(outputs), true);
    assert.equal(outputs[0].path, 'environment.total.temperature');
    assert.equal(outputs[0].value, 17);
    // No input meta provided -> no output meta
    assert.deepEqual(meta, []);
  });
  it('should return a product for matched paths', () => {
    const { outputs } = combiner({
      'electrical.panels.voltage': 12,
      'electrical.panels.current': 5,
    }, {
      paths: [
        {
          operation: 'multiplication',
          input: [
            'electrical.panels.voltage',
            'electrical.panels.current',
          ],
          output: 'electrical.panels.power',
        },
      ],
    }, noopApp);
    assert.equal(outputs[0].path, 'electrical.panels.power');
    assert.equal(outputs[0].value, 60);
  });
  it('should not compute multiplication without enough values', () => {
    const { outputs } = combiner({
      'electrical.panels.voltage': 12,
    }, {
      paths: [
        {
          operation: 'multiplication',
          input: [
            'electrical.panels.voltage',
            'electrical.panels.current',
          ],
          output: 'electrical.panels.power',
        },
      ],
    }, noopApp);
    assert.equal(outputs.length, 0);
  });

  describe('units inference', () => {
    it('emits units when both inputs share the same unit', () => {
      const { meta } = combiner({
        'electrical.solar.1.power': 100,
        'electrical.solar.2.power': 80,
      }, {
        paths: [
          {
            operation: 'addition',
            input: [
              'electrical.solar.1.power',
              'electrical.solar.2.power',
            ],
            output: 'electrical.solar.totalPower',
          },
        ],
      }, noopApp, {
        'electrical.solar.1.power': { units: 'W' },
        'electrical.solar.2.power': { units: 'W' },
      });
      assert.deepEqual(meta, [
        { path: 'electrical.solar.totalPower', value: { units: 'W' } },
      ]);
    });
    it('uses the single unit when only one input has units', () => {
      const { meta } = combiner({
        'tanks.fresh.1.currentVolume': 100,
        'tanks.fresh.2.currentVolume': 80,
      }, {
        paths: [
          {
            operation: 'addition',
            input: [
              'tanks.fresh.1.currentVolume',
              'tanks.fresh.2.currentVolume',
            ],
            output: 'tanks.fresh.totalVolume',
          },
        ],
      }, noopApp, {
        'tanks.fresh.1.currentVolume': { units: 'L' },
      });
      assert.deepEqual(meta, [
        { path: 'tanks.fresh.totalVolume', value: { units: 'L' } },
      ]);
    });
    it('emits no units when inputs have different units', () => {
      const { meta } = combiner({
        'a.value': 1,
        'b.value': 2,
      }, {
        paths: [
          {
            operation: 'addition',
            input: ['a.value', 'b.value'],
            output: 'c.value',
          },
        ],
      }, noopApp, {
        'a.value': { units: 'V' },
        'b.value': { units: 'A' },
      });
      assert.deepEqual(meta, []);
    });
    it('emits no units when no inputs have units', () => {
      const { meta } = combiner({
        'a.value': 1,
        'b.value': 2,
      }, {
        paths: [
          {
            operation: 'addition',
            input: ['a.value', 'b.value'],
            output: 'c.value',
          },
        ],
      }, noopApp, {});
      assert.deepEqual(meta, []);
    });
    it('shares the unit across multiplication when inputs agree', () => {
      // Same unit on both factors: emit it (matches the simple heuristic).
      const { meta } = combiner({
        'a.value': 2,
        'b.value': 3,
      }, {
        paths: [
          {
            operation: 'multiplication',
            input: ['a.value', 'b.value'],
            output: 'c.value',
          },
        ],
      }, noopApp, {
        'a.value': { units: 'ratio' },
        'b.value': { units: 'ratio' },
      });
      assert.deepEqual(meta, [
        { path: 'c.value', value: { units: 'ratio' } },
      ]);
    });
    it('emits no units for multiplication with differing units', () => {
      // V * A would be W, but the plugin does not model compound units.
      const { meta } = combiner({
        'a.value': 12,
        'b.value': 5,
      }, {
        paths: [
          {
            operation: 'multiplication',
            input: ['a.value', 'b.value'],
            output: 'c.value',
          },
        ],
      }, noopApp, {
        'a.value': { units: 'V' },
        'b.value': { units: 'A' },
      });
      assert.deepEqual(meta, []);
    });
    it('ignores inputs that have no value yet', () => {
      const { meta } = combiner({
        'electrical.solar.1.power': 100,
      }, {
        paths: [
          {
            operation: 'addition',
            input: [
              'electrical.solar.1.power',
              'electrical.solar.2.power',
            ],
            output: 'electrical.solar.totalPower',
          },
        ],
      }, noopApp, {
        'electrical.solar.1.power': { units: 'W' },
        'electrical.solar.2.power': { units: 'W' },
      });
      // Addition still sums the one available value; unit is shared.
      assert.deepEqual(meta, [
        { path: 'electrical.solar.totalPower', value: { units: 'W' } },
      ]);
    });
  });
});
