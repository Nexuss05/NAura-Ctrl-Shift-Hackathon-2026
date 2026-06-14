/**
 * NDVI data source (simulated remote-sensing oracle).
 *
 * NDVI (Normalized Difference Vegetation Index) measures vegetation cover in [-1, 1]; this protocol
 * represents it as i64 x 1000 throughout (no floats). True trustlessness requires an on-chain oracle
 * (Switchboard / Pyth / a dedicated remote-sensing oracle). Here a deterministic increasing sequence
 * simulates afforestation progress rising over time (checkpoints), to demonstrate the agent's
 * "only release once the threshold is met" logic.
 */
export class SimulatedNdviOracle {
  private base: number;
  private step: number;

  /**
   * @param baseNdvi   starting NDVI x 1000 (e.g. 250 = 0.250, sparse vegetation early on)
   * @param stepNdvi   increase per checkpoint x 1000 (e.g. 120 = +0.120)
   */
  constructor(baseNdvi = 250, stepNdvi = 120) {
    this.base = baseNdvi;
    this.step = stepNdvi;
  }

  /** Read the NDVI x 1000 at the given checkpoint (checkpoint starts at 0). */
  read(checkpoint: number): number {
    return this.base + this.step * checkpoint;
  }
}
