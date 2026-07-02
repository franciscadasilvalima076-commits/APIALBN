export class Scheduler {
  private static instance: Scheduler;
  private tasks: Map<string, { interval: NodeJS.Timeout; ms: number; callback: () => void }> = new Map();

  private constructor() {}

  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  public schedule(id: string, callback: () => void, ms: number): void {
    if (this.tasks.has(id)) {
      this.unschedule(id);
    }
    const interval = setInterval(() => {
      try {
        callback();
      } catch (err) {
        console.error(`Error executing scheduled task [${id}]:`, err);
      }
    }, ms);

    this.tasks.set(id, { interval, ms, callback });
  }

  public unschedule(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      clearInterval(task.interval);
      this.tasks.delete(id);
    }
  }

  public clearAll(): void {
    this.tasks.forEach((task, id) => {
      clearInterval(task.interval);
    });
    this.tasks.clear();
  }
}
