const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const combiner = require('../plugin/combiner');

describe('Combiner', () => {
  it('should return empty array for empty input', () => {
    const output = combiner({}, {
      paths: [],
    });
    assert.equal(Array.isArray(output), true);
    assert.equal(output.length, 0);
  });
  it('should return a sum for matched paths', () => {
    const output = combiner({
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
    });
    assert.equal(Array.isArray(output), true);
    assert.equal(output[0].path, 'environment.total.temperature');
    assert.equal(output[0].value, 17);
  });
});
