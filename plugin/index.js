const combiner = require('./combiner');

module.exports = (app) => {
  const plugin = {};
  const values = {};
  // Input path -> meta (units, etc.) recorded from subscription deltas.
  // Used to infer the unit of combined output paths.
  const inputMeta = {};
  // Output path -> units last published as meta, so we only emit a
  // meta delta when the inferred unit actually changes.
  const publishedUnits = {};
  let unsubscribes = [];
  plugin.id = 'signalk-value-combiner';
  plugin.name = 'Value combiner';
  plugin.description = 'Combine values from multiple Signal K paths';

  plugin.start = (settings) => {
    if (!settings.paths || !settings.paths.length) {
      app.setPluginStatus('No paths configured');
      return;
    }
    const subscriptions = [];
    // Subscribe to input paths
    settings.paths.forEach((path) => {
      path.input.forEach((input) => {
        subscriptions.push({
          path: input,
          period: 500,
        });
      });
    });
    app.subscriptionmanager.subscribe(
      {
        context: 'self',
        subscribe: subscriptions,
      },
      unsubscribes,
      (subscriptionError) => {
        app.error(subscriptionError);
      },
      (delta) => {
        if (!delta.updates) {
          return;
        }
        // Record inputs and their meta
        delta.updates.forEach((u) => {
          if (u.values) {
            u.values.forEach((v) => {
              values[v.path] = v.value;
            });
          }
          if (u.meta) {
            u.meta.forEach((m) => {
              inputMeta[m.path] = m.value || {};
            });
          }
        });
        const { outputs, meta } = combiner(values, settings, app, inputMeta);
        if (!outputs.length) {
          app.setPluginStatus('No values to publish');
          return;
        }
        app.handleMessage(plugin.id, {
          context: `vessels.${app.selfId}`,
          updates: [
            {
              source: {
                label: plugin.id,
              },
              timestamp: (new Date().toISOString()),
              values: outputs,
            },
          ],
        });
        // Publish inferred units (and other meta) for outputs whose
        // unit changed since the last emission. Sent as a separate
        // meta delta so it isn't repeated on every value update.
        const metaToSend = meta.filter((m) => {
          const units = m.value && m.value.units;
          if (publishedUnits[m.path] === units) {
            return false;
          }
          publishedUnits[m.path] = units;
          return true;
        });
        if (metaToSend.length) {
          app.handleMessage(plugin.id, {
            context: `vessels.${app.selfId}`,
            updates: [
              {
                source: {
                  label: plugin.id,
                },
                timestamp: (new Date().toISOString()),
                meta: metaToSend,
              },
            ],
          });
        }
        app.setPluginStatus(`Published ${outputs.length} values`);
      },
    );
  };

  plugin.stop = () => {
    Object.keys(values).forEach((key) => {
      delete values[key];
    });
    Object.keys(inputMeta).forEach((key) => {
      delete inputMeta[key];
    });
    Object.keys(publishedUnits).forEach((key) => {
      delete publishedUnits[key];
    });
    unsubscribes.forEach((f) => f());
    unsubscribes = [];
  };

  plugin.schema = () => ({
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        title: 'Paths to combine',
        minItems: 0,
        items: {
          type: 'object',
          required: [
            'input',
            'output',
          ],
          properties: {
            description: {
              type: 'string',
            },
            input: {
              type: 'array',
              minItems: 2,
              items: {
                title: 'Input path',
                type: 'string',
              },
            },
            output: {
              title: 'Output path',
              type: 'string',
            },
            operation: {
              type: 'string',
              description: 'Operation',
              default: 'addition',
              oneOf: [
                {
                  const: 'addition',
                  title: '+',
                },
                {
                  const: 'multiplication',
                  title: '*',
                },
              ],
            },
          },
        },
      },
    },
  });

  return plugin;
};
