// Fictional, in-memory data. This is not a production database or auth system.
export const demoOrders = new Map([
  ["order-1", { owner: "alice", amount: 100, status: "pending" }],
  ["order-2", { owner: "bob", amount: 200, status: "pending" }],
]);
export function getDemoActor() { return "alice"; }
// A mock SQL sink for static pattern matching; it does not execute SQL.
export const demoDB = { async query(sql: string, params: unknown[] = []) { return { sql, params, executed: false }; } };
export function demoProfile(userId: string) { return { userId, note: "Fictional private profile for " + userId }; }
