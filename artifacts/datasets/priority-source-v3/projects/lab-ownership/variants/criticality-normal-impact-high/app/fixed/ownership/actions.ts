"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
import { revalidatePath } from "next/cache";
export async function updateOrder(form: FormData) {
  const id = String(form.get("orderId"));
  const amount = Number(form.get("amount"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount");
  demoOrders.set(id, { ...order, amount });
  revalidatePath("/fixed/ownership");
}
