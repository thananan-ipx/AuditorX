import { ApiError } from "@/lib/api-client";
import { isActive, type Finding, type Scan } from "../types";
import { scanService } from "./scan-service";

export type ScanState = {
  phase: "loading" | "ready" | "error";
  jobs: Scan[];
  selected: Scan | null;
  findings: Finding[] | null;
  action: "start" | "upload" | "local" | "cancel" | null;
  error: unknown;
  notice: string;
};

const initialState = (): ScanState => ({ phase: "loading", jobs: [], selected: null, findings: null, action: null, error: null, notice: "" });
type Clock = { schedule: (callback: () => void, delay: number) => () => void };
const clock: Clock = { schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); } };

/** One repository per instance. Poll only after reads settle; never retry a mutation. */
export class ScanController {
  private state = initialState();
  private listeners = new Set<() => void>();
  private alive = false;
  private generation = 0;
  private request?: AbortController;
  private stopTimer?: () => void;
  private selectedID?: string;

  constructor(
    private repositoryID: string,
    private branch: string,
    private canWrite: boolean,
    private api = scanService,
    private timer = clock,
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ScanState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private invalidate() {
    this.stopTimer?.();
    this.stopTimer = undefined;
    this.request?.abort();
    this.generation += 1;
  }
  private begin() {
    this.invalidate();
    const controller = new AbortController();
    this.request = controller;
    const generation = this.generation;
    return { signal: controller.signal, current: () => this.alive && this.generation === generation };
  }
  start = () => {
    this.alive = true;
    // React Strict Mode may start again after cleanup. Discard the old action lock.
    this.publish({ ...initialState() });
    void this.refresh();
  };
  stop = () => { this.alive = false; this.invalidate(); };

  refresh = async () => {
    if (!this.alive || this.state.action) return;
    const { signal, current } = this.begin();
    try {
      const jobs = await this.api.list(this.repositoryID, signal);
      if (!current()) return;
      const id = this.selectedID ?? jobs[0]?.id;
      const selected = id ? await this.api.get(this.repositoryID, id, signal) : null;
      if (!current()) return;
      const findings = selected?.status === "completed"
        ? await this.api.findings(this.repositoryID, selected.id, signal) : null;
      if (!current()) return;
      this.selectedID = selected?.id;
      // A detail response can be newer than the list from the same refresh.
      const updated = jobs.map((job) => job.id === selected?.id ? selected : job);
      this.publish({ phase: "ready", jobs: updated, selected, findings, error: null });
      if (updated.some(isActive) || (selected && isActive(selected))) {
        this.stopTimer = this.timer.schedule(() => { void this.refresh(); }, 3000);
      }
    } catch (error) {
      if (current()) this.fail(error);
    }
  };

  retry = () => {
    if (!this.alive || this.state.action) return;
    this.publish({ phase: "loading", error: null });
    void this.refresh();
  };

  select = (id: string) => {
    if (!this.alive || this.state.action || !this.state.jobs.some((job) => job.id === id)) return;
    this.selectedID = id;
    this.publish({ phase: "loading", selected: null, findings: null, notice: "" });
    void this.refresh();
  };

  private fail(error: unknown) {
    // Hide protected/stale results even for transient failures. Manual retry is read-only.
    this.publish({ phase: "error", jobs: [], selected: null, findings: null, action: null, error });
  }

  enqueue = () => this.mutate("start");
  upload = (source: FormData) => this.mutate("upload", source);
  local = (path: string) => this.mutate("local", undefined, path);
  cancel = () => this.mutate("cancel");
  private async mutate(action: "start" | "upload" | "local" | "cancel", source?: FormData, path?: string) {
    if (!this.alive || !this.canWrite || this.state.action || this.state.phase !== "ready") return;
    if ((action !== "cancel") && (this.state.jobs.some(isActive) || (this.state.selected && isActive(this.state.selected)))) return;
    const selected = this.state.selected;
    if (action === "cancel" && (!selected || !isActive(selected))) return;
    const { signal, current } = this.begin();
    this.publish({ action, notice: "" });
    try {
      const job = action === "local" ? await this.api.local(this.repositoryID, path!, signal) : action === "start"
        ? await this.api.start(this.repositoryID, this.branch, signal)
        : action === "upload"
          ? await this.api.upload(this.repositoryID, source!, signal)
          : await this.api.cancel(this.repositoryID, selected!.id, signal);
      if (!current()) return;
      this.selectedID = job.id;
      this.publish({ action: null, phase: "loading", selected: null, findings: null,
        notice: action === "local" ? "Local path scan saved to the queue. Files are read when the worker starts." : action === "start" ? "Scan saved to the queue. Its current status is shown below."
          : action === "upload" ? "Local source uploaded and saved to the scan queue."
          : "Cancellation saved. This scan can no longer publish results; its analyzer may take time to stop." });
      await this.refresh();
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 409 && error.code === "SCAN_CONFLICT") {
        if (action !== "cancel") this.selectedID = undefined;
        this.publish({ action: null, notice: "The scan state changed in another request. The latest state is shown below." });
        await this.refresh();
      } else {
        this.publish({ notice: "The action could not be confirmed. Retry reloads status only; it does not submit the action again." });
        this.fail(error);
      }
    }
  }
}
