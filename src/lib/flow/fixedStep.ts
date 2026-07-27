export type FixedStepResult = {
  steps: number;
  remainingAccumulator: number;
  newCycle: number;
};

export function computeFixedSteps(
  accumulator: number,
  delta: number,
  fixedStep: number,
  maxSubsteps: number,
  currentCycle: number
): FixedStepResult {
  const cappedDelta = Math.min(delta, fixedStep * maxSubsteps * 2);
  let newAccumulator = Math.min(accumulator + cappedDelta, fixedStep * maxSubsteps * 2);
  let steps = 0;
  let cycle = currentCycle;

  while (newAccumulator >= fixedStep && steps < maxSubsteps) {
    cycle += 1;
    newAccumulator -= fixedStep;
    steps += 1;
  }

  return {
    steps,
    remainingAccumulator: newAccumulator,
    newCycle: cycle,
  };
}