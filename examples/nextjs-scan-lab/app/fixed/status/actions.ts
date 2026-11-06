"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
export async function updateStatus(form: FormData) {
  const id = String(form.get("orderId"));
  const status = String(form.get("status"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  if (!["pending", "cancelled"].includes(status)) throw new Error("Invalid status");
  if (order.status !== "pending") throw new Error("Invalid transition");
  demoOrders.set(id, { ...order, status });
}
