import { updateStatus } from "./actions";
export default function Page() { return <main><h1>unsafe: status</h1><p>Fictional orders; demo actor is Alice.</p><form action={updateStatus}><input name="orderId" defaultValue="order-1" /><input name="status" defaultValue="pending" /><button>Update demo record</button></form></main>; }
