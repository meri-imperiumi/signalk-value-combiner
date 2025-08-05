module.exports = (app) => {
  const plugin = {};
  const values = {};
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
        // Record inputs
        delta.updates.forEach((u) => {
          if (!u.values) {
            return;
          }
          u.values.forEach((v) => {
            values[v.path] = v.value;
          });
        });
        // Produce outputs
        const outputs = [];
        settings.paths.forEach((path) => {
          let sum = 0;
          for (let i = 0; i < path.input.length; i += 1) {
            const inputPath = path.input[i];
            if (typeof values[inputPath] === 'undefined') {
              console.log(`Path ${path.output} is missing ${inputPath}`);
              return;
            }
            sum += values[inputPath];
          }
          outputs.push({
            path: path.output,
            value: sum,
          });
        });
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
        app.setPluginStatus(`Published ${outputs.length} values`);
      },
    );
  };

  plugin.stop = () => {
    Object.keys(values).forEach((key) => {
      delete values[key];
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
          },
        },
      },
    },
  });

  return plugin;
};
