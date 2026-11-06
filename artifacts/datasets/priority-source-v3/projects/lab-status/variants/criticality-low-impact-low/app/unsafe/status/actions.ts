"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
export async function updateStatus(form: FormData) {
  const id = String(form.get("orderId"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  demoOrders.set(id, { ...order, status: String(form.get("status")) });
}
