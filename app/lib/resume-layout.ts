export const RESUME_FONT_SIZE_OPTIONS = [5, 6, 7, 8, 9] as const;

export type ResumeFontSize = (typeof RESUME_FONT_SIZE_OPTIONS)[number];
export type ResumeDensity = "relaxed" | "normal" | "compact" | "ultra";

export const RELAXED_ENTER_MAX_FILL_RATIO = 0.72;

export function effectiveResumeDensity(
  smartOnePage: boolean,
  density: ResumeDensity,
): ResumeDensity {
  return smartOnePage ? density : "normal";
}

export function normalizeResumeFontSize(value: unknown): ResumeFontSize {
  if (typeof value !== "number" || !Number.isFinite(value)) return 9;
  if (value >= 9) return 9;
  if (value <= 5) return 5;

  return RESUME_FONT_SIZE_OPTIONS.reduce<ResumeFontSize>(
    (nearest, option) =>
      Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest,
    5,
  );
}

export type SmartLayoutDecisionInput = {
  density: ResumeDensity;
  fitsOnePage: boolean;
  fillRatio: number;
  relaxedRejected: boolean;
  exhausted: boolean;
};

export type SmartLayoutDecision = {
  density: ResumeDensity;
  relaxedRejected: boolean;
  exhausted: boolean;
};

export function decideSmartLayout(
  input: SmartLayoutDecisionInput,
): SmartLayoutDecision {
  if (input.exhausted) {
    return { density: "compact", relaxedRejected: true, exhausted: true };
  }

  if (input.density === "relaxed") {
    return input.fitsOnePage
      ? {
          density: "relaxed",
          relaxedRejected: input.relaxedRejected,
          exhausted: false,
        }
      : { density: "normal", relaxedRejected: true, exhausted: false };
  }

  if (input.density === "normal") {
    if (!input.fitsOnePage) {
      return {
        density: "compact",
        relaxedRejected: input.relaxedRejected,
        exhausted: false,
      };
    }
    if (
      !input.relaxedRejected &&
      input.fillRatio <= RELAXED_ENTER_MAX_FILL_RATIO
    ) {
      return { density: "relaxed", relaxedRejected: false, exhausted: false };
    }
    return {
      density: "normal",
      relaxedRejected: input.relaxedRejected,
      exhausted: false,
    };
  }

  if (input.density === "compact") {
    return input.fitsOnePage
      ? {
          density: "compact",
          relaxedRejected: input.relaxedRejected,
          exhausted: false,
        }
      : {
          density: "ultra",
          relaxedRejected: input.relaxedRejected,
          exhausted: false,
        };
  }

  return input.fitsOnePage
    ? {
        density: "ultra",
        relaxedRejected: input.relaxedRejected,
        exhausted: false,
      }
    : { density: "compact", relaxedRejected: true, exhausted: true };
}
