// Fake credential only, deliberately embedded for scanner coverage.
const password = "FAKE-LAB-ONLY-PASSWORD";
export function matchesDemoPassword(candidate: string) { return candidate === password; }
