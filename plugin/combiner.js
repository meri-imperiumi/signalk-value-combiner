// Determine the units to assign to a combined output path.
//
// Signal K numeric values may carry `units` metadata (e.g. "W",
// "V", "K"). Combining paths drops this unless we make a deliberate
// choice. The heuristic here follows the user's request:
//
// - addition: the inputs describe the same quantity, so a shared unit
//   is meaningful. If all inputs that carry a unit agree on it, the
//   output inherits it. If only one input carries a unit, use it.
// - multiplication: units multiply (V*A=W), which this plugin does not
//   model. Only emit a unit when a single input carries one, or when
//   every input that carries a unit agrees on the same unit. When two
//   different units are present the result unit is ambiguous, so we
//   emit nothing rather than a wrong value.
//
// `inputMeta` is a map of path -> { units?, ... }.
function inferUnits(operation, inputs, inputMeta) {
  const units = inputs
    .map((p) => (inputMeta[p] && inputMeta[p].units) || null)
    .filter((u) => u !== null);
  if (!units.length) {
    return null;
  }
  const unique = new Set(units);
  // A single input carrying a unit, or all carrying the same unit.
  if (unique.size === 1) {
    return units[0];
  }
  // Different units across inputs: safe only for addition when the
  // inputs are meant to be summed in the same dimension. We still
  // can't pick, so emit nothing.
  return null;
}

module.exports = (values, settings, app, inputMeta) => {
  // Produce outputs
  const outputs = [];
  const metaOutputs = [];
  settings.paths.forEach((path) => {
    const operation = path.operation || 'addition';
    // Collect numbers just for this one
    const matching = Object
      .keys(values)
      .filter((p) => path.input.indexOf(p) !== -1);
    const numbers = matching.map((p) => values[p]);
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
        metaOutputs.push({
          path: path.output,
          operation,
          inputs: matching,
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
        metaOutputs.push({
          path: path.output,
          operation,
          inputs: matching,
        });
        break;
      }
    }
  });
  // Resolve units for each output from the inputs that fed it.
  const outputMeta = [];
  metaOutputs.forEach((entry) => {
    const units = inferUnits(entry.operation, entry.inputs, inputMeta || {});
    if (units) {
      outputMeta.push({ path: entry.path, value: { units } });
    }
  });
  return { outputs, meta: outputMeta };
};
