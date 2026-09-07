export interface SwitchMotion {
  sequence: number;
  travel: number;
  compressionRemaining: number;
  active: boolean;
}

export function createSwitchMotion(sequence = 0): SwitchMotion {
  return { sequence, travel: 0, compressionRemaining: 0, active: false };
}

/** One retargetable stroke: even down/up within a single frame remains visible. */
export function advanceSwitchMotion(motion: SwitchMotion, sequence: number, pressed: boolean, delta: number, reducedMotion = false) {
  if (sequence !== motion.sequence) {
    motion.sequence = sequence;
    motion.compressionRemaining = 0.03;
    motion.active = true;
  }
  // The first demand frame may arrive seconds after the previous frame.
  const step = Math.min(Math.max(delta, 0), 1 / 30);
  const compressing = pressed || motion.compressionRemaining > 0;
  const target = compressing ? 1 : 0;
  motion.travel = reducedMotion ? target : target + (motion.travel - target) * Math.exp(-(compressing ? 65 : 42) * step);
  motion.compressionRemaining = Math.max(0, motion.compressionRemaining - step);
  if (Math.abs(target - motion.travel) < 0.002) motion.travel = target;
  motion.active = motion.travel !== target || (!pressed && compressing);
  return motion;
}
