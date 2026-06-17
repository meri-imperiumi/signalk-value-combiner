module.exports = (values, settings, app) => {
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
  return outputs;
};
