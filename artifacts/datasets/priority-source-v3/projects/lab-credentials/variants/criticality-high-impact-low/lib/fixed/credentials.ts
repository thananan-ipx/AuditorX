export function matchesDemoPassword(candidate: string) {
  const expected = process.env.LAB_DEMO_PASSWORD;
  return Boolean(expected) && candidate === expected;
}
