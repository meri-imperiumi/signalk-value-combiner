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
          const operation = path.operation || 'addition';
          // Collect numbers just for this one
          const numbers = Object
            .keys(values)
            .filter((p) => path.input.indexOf(p) !== -1)
            .map((p) => values[p]);
          let result = 0;
          switch (operation) {
            case 'multiplication': {
              if (numbers.length < 2) {
                app.debug(`Missing values for computation ${path.output}`);
                break;
              }
              result = numbers.shift();
              for (let i = 0; i < numbers.length; i += 1) {
                result *= numbers[i];
              }
              outputs.push({
                path: path.output,
                value: result,
              });
              break;
            }
            case 'addition':
            default: {
              for (let i = 0; i < numbers.length; i += 1) {
                result += numbers[i];
              }
              outputs.push({
                path: path.output,
                value: result,
              });
              break;
            }
          }
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
