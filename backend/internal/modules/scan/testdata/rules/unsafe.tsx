const child_process = require("node:child_process");

export function unsafe(input: string, database: { query(sql: string): void }) {
  const accessToken = "production-secret-value";
  console.log("credential", accessToken);
  eval(input);
  child_process.exec(input);
  database.query(`SELECT * FROM users WHERE id = ${input}`);
}

export function safe(input: string, database: { query(sql: string, values: string[]): void }) {
  const accessToken = process.env.ACCESS_TOKEN;
  console.log("request completed");
  child_process.execFile("tool", [input]);
  database.query("SELECT * FROM users WHERE id = ?", [input]);
  return accessToken;
}
