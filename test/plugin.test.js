const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const pluginFactory = require('../plugin/index');

// Minimal fake app: captures the subscription callback so a test can
// feed deltas in and inspect the messages emitted via handleMessage.
function makeApp() {
  const messages = [];
  let subscribeCallback = null;
  const app = {
    selfId: 'self',
    debug: () => {},
    error: () => {},
    setPluginStatus: () => {},
    handleMessage: (id, data) => {
      messages.push({ id, data });
    },
    subscriptionmanager: {
      subscribe(command, unsubs, onError, callback) {
        subscribeCallback = callback;
      },
    },
  };
  return { app, messages, getCallback: () => subscribeCallback };
}

describe('plugin', () => {
  it('exposes the Signal K plugin interface', () => {
    const { app } = makeApp();
    const plugin = pluginFactory(app);
    assert.equal(plugin.id, 'signalk-value-combiner');
    assert.equal(typeof plugin.start, 'function');
    assert.equal(typeof plugin.stop, 'function');
    assert.equal(typeof plugin.schema, 'function');
  });

  it('publishes combined values for a delta', () => {
    const { app, messages, getCallback } = makeApp();
    const plugin = pluginFactory(app);
    plugin.start({
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
    });
    const delta = getCallback();
    assert.ok(delta, 'subscription callback was registered');

    delta({
      updates: [
        {
          values: [
            { path: 'electrical.solar.1.power', value: 100 },
            { path: 'electrical.solar.2.power', value: 80 },
          ],
        },
      ],
    });

    const valueMsg = messages.find(
      (m) => m.data.updates[0].values,
    );
    assert.ok(valueMsg, 'a value delta was published');
    assert.deepEqual(valueMsg.data.updates[0].values, [
      { path: 'electrical.solar.totalPower', value: 180 },
    ]);
    plugin.stop();
  });

  it('captures input meta and publishes inferred units', () => {
    const { app, messages, getCallback } = makeApp();
    const plugin = pluginFactory(app);
    plugin.start({
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
    });
    const delta = getCallback();

    // First a meta delta arrives carrying units for both inputs.
    // No input values have been recorded yet, so the combiner emits a
    // zero-valued sum (existing behavior) but no inferred-unit meta,
    // since no input paths matched.
    delta({
      updates: [
        {
          meta: [
            { path: 'electrical.solar.1.power', value: { units: 'W' } },
            { path: 'electrical.solar.2.power', value: { units: 'W' } },
          ],
        },
      ],
    });
    assert.equal(messages.length, 1, 'a zero-valued value delta is published');
    assert.equal(
      messages.filter((m) => m.data.updates[0].meta).length,
      0,
      'no units meta while no input values have arrived',
    );

    // Then values arrive; the inferred unit is published once.
    delta({
      updates: [
        {
          values: [
            { path: 'electrical.solar.1.power', value: 100 },
            { path: 'electrical.solar.2.power', value: 80 },
          ],
        },
      ],
    });

    const metaMsgs = messages.filter((m) => m.data.updates[0].meta);
    assert.equal(metaMsgs.length, 1, 'units meta published exactly once');
    assert.deepEqual(metaMsgs[0].data.updates[0].meta, [
      { path: 'electrical.solar.totalPower', value: { units: 'W' } },
    ]);

    // A subsequent value update must NOT re-emit the same meta.
    delta({
      updates: [
        {
          values: [
            { path: 'electrical.solar.1.power', value: 110 },
          ],
        },
      ],
    });
    const metaMsgs2 = messages.filter((m) => m.data.updates[0].meta);
    assert.equal(metaMsgs2.length, 1, 'duplicate units meta not re-published');

    plugin.stop();
  });

  it('reports no paths configured when started empty', () => {
    const { app } = makeApp();
    const plugin = pluginFactory(app);
    plugin.start({ paths: [] });
    // No subscription should be attempted; nothing to assert beyond
    // not throwing. The plugin stop is a safe no-op here.
    plugin.stop();
  });
});
