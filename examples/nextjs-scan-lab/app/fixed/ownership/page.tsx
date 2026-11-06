import { updateOrder } from "./actions";
export default function Page() { return <main><h1>fixed: ownership</h1><p>Fictional orders; demo actor is Alice.</p><form action={updateOrder}><input name="orderId" defaultValue="order-1" /><input name="amount" defaultValue="100" /><button>Update demo record</button></form></main>; }
