"use server";
import { demoOrders } from "@/lib/demo-data";
import { revalidatePath } from "next/cache";
export async function updateOrder(form: FormData) {
  const id = String(form.get("orderId"));
  const order = demoOrders.get(id);
  if (order) demoOrders.set(id, { ...order, amount: Number(form.get("amount")) });
  revalidatePath("/unsafe/ownership");
}
