"use client";
// Scan-only fixture, intentionally not imported into the runnable app.
import fs from "node:fs";
export default function ClientBoundary() { return <p>{String(fs.existsSync("lab-only.txt"))}</p>; }
