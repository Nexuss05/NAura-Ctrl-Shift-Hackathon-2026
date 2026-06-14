/**
 * Main-AI recommender: given a region + budget, produce an afforestation funding plan.
 *
 * The AI part uses **Claude Code (the local `claude` CLI, headless)** — no paid API, no API key
 * (it reuses your existing Claude Code auth). If `claude` is unavailable or fails, it falls back to a
 * deterministic local planner so the demo always runs.
 *
 * Switch via env var:
 *   Naura_RECOMMENDER=claude (default) -> call the local claude CLI
 *   Naura_RECOMMENDER=local            -> force the local planner (fast, deterministic, no deps)
 *
 * The recommendation hash (sha256) is written to Project.recommendation_hash, anchoring it on-chain.
 */
import { createHash } from "crypto";
import { execFile } from "child_process";

export interface Milestone {
  label: string;
  fraction: number; // share of budget, 0..1, summing to ~1
}

export interface Recommendation {
  beneficiaryOrgName: string;
  ndviThresholdScaled: number; // NDVI x 1000, the impact threshold for release
  milestones: Milestone[];
  rationale: string;
  source: "claude-code" | "local";
}

export interface RecommendationInput {
  region: string;
  countryCode: string; // 2 letters, e.g. "BR"
  budgetSol: number;
}

/** Compute the recommendation hash (32 bytes) for on-chain anchoring. */
export function recommendationHash(rec: Recommendation): number[] {
  const canonical = JSON.stringify({
    beneficiaryOrgName: rec.beneficiaryOrgName,
    ndviThresholdScaled: rec.ndviThresholdScaled,
    milestones: rec.milestones,
  });
  return Array.from(createHash("sha256").update(canonical).digest());
}

/** Deterministic local planner (no external dependency). */
function localRecommendation(input: RecommendationInput): Recommendation {
  return {
    beneficiaryOrgName: `${input.region} Reforestation Trust`,
    ndviThresholdScaled: 300, // 0.300
    milestones: [
      { label: "Seedling planting & registration", fraction: 0.4 },
      { label: "6-month survival verification", fraction: 0.35 },
      { label: "12-month canopy verification", fraction: 0.25 },
    ],
    rationale: `For ${input.region} (${input.countryCode}) with a ${input.budgetSol} SOL budget, release in three milestones by NDVI progress: establish a vegetation baseline first, then verify survival and canopy over time.`,
    source: "local",
  };
}

const PROMPT = (input: RecommendationInput) =>
  [
    "You are the main AI planner for Naura, an afforestation funding protocol.",
    `Region: ${input.region}; country code: ${input.countryCode}; budget: ${input.budgetSol} SOL.`,
    "Produce an afforestation funding plan. Output ONLY a single JSON object (no markdown, no prose), with fields:",
    '{"beneficiaryOrgName": string (the reforestation org),',
    '"ndviThresholdScaled": integer (NDVI impact threshold for release, x 1000, typically 300-600),',
    '"milestones": [{"label": string, "fraction": number}] (2-4 milestones; fractions MUST sum to 1),',
    '"rationale": string (brief justification)}',
  ].join("\n");

/** Generate a recommendation with the local claude CLI (Claude Code headless). */
function claudeCodeRecommendation(input: RecommendationInput): Promise<Recommendation> {
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      ["-p", PROMPT(input), "--output-format", "json"],
      { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          // --output-format json returns an envelope { ..., "result": "<model text>" }.
          let text = stdout.trim();
          try {
            const envelope = JSON.parse(text);
            if (envelope && typeof envelope.result === "string") text = envelope.result;
          } catch {
            /* not an envelope; treat as plain text */
          }
          // Extract the JSON object from the text (tolerate possible code fences).
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start < 0 || end < 0) throw new Error("no JSON found");
          const parsed = JSON.parse(text.slice(start, end + 1));
          if (
            typeof parsed.beneficiaryOrgName !== "string" ||
            typeof parsed.ndviThresholdScaled !== "number" ||
            !Array.isArray(parsed.milestones)
          ) {
            throw new Error("incomplete fields");
          }
          resolve({
            beneficiaryOrgName: parsed.beneficiaryOrgName,
            ndviThresholdScaled: Math.round(parsed.ndviThresholdScaled),
            milestones: parsed.milestones.map((m: any) => ({ label: String(m.label), fraction: Number(m.fraction) })),
            rationale: String(parsed.rationale ?? ""),
            source: "claude-code",
          });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/** Get a recommendation: Claude Code by default, falling back to the local planner on failure. */
export async function getRecommendation(input: RecommendationInput): Promise<Recommendation> {
  if (process.env.Naura_RECOMMENDER === "local") return localRecommendation(input);
  try {
    return await claudeCodeRecommendation(input);
  } catch (err) {
    console.warn(`[recommender] Claude Code unavailable, falling back to local planner: ${(err as Error).message}`);
    return localRecommendation(input);
  }
}
