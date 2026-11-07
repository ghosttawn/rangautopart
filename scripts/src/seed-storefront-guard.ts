export function assertInitialSeedIntent(
  nodeEnv: string | undefined,
  confirmation: string | undefined,
) {
  if (nodeEnv !== "development" && nodeEnv !== "production") {
    throw new Error(
      "Set NODE_ENV to development or production before running the initial storefront seed.",
    );
  }
  if (confirmation !== nodeEnv) {
    throw new Error(
      `Set RANG_INITIAL_SEED_CONFIRM=${nodeEnv} to explicitly confirm this one-time seed.`,
    );
  }
}
