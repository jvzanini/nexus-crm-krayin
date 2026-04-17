import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do redis antes de importar o módulo
vi.mock("@/lib/redis", () => ({
  redis: { status: "ready" },
}));

// Mock do BullMQ Queue
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockRemove = vi.fn();

vi.mock("bullmq", () => {
  class MockQueue {
    add = mockAdd;
    getJob = mockGetJob;
    constructor(_name: string, _opts?: unknown) {}
  }
  return { Queue: MockQueue };
});

// Importar após mocks
const { scheduleReminder, cancelReminder } = await import("../activity-reminders");

describe("activity-reminders queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scheduleReminder", () => {
    it("deve chamar queue.add com delay positivo para reminderAt no futuro", async () => {
      const now = Date.now();
      const reminderAt = new Date(now + 60_000); // 1 minuto no futuro

      mockAdd.mockResolvedValue({ id: "job-123" });

      const jobId = await scheduleReminder({
        id: "act-1",
        reminderAt,
        assignedTo: "user-1",
        createdBy: "user-2",
        subjectType: "lead",
        subjectId: "lead-1",
        title: "Ligar para cliente",
      });

      expect(mockAdd).toHaveBeenCalledOnce();
      expect(jobId).toBe("job-123");

      const [eventName, payload, options] = mockAdd.mock.calls[0];
      expect(eventName).toBe("reminder");
      expect(payload.id).toBe("act-1");
      expect(options.delay).toBeGreaterThan(0);
      expect(options.delay).toBeLessThanOrEqual(60_000);
      expect(options.removeOnComplete).toBe(true);
      expect(options.removeOnFail).toBe(1000);
    });

    it("deve usar delay=0 para reminderAt no passado", async () => {
      const reminderAt = new Date(Date.now() - 5_000); // 5 segundos no passado

      mockAdd.mockResolvedValue({ id: "job-456" });

      await scheduleReminder({
        id: "act-2",
        reminderAt,
        assignedTo: null,
        createdBy: "user-3",
        subjectType: "contact",
        subjectId: "contact-1",
        title: "Reunião atrasada",
      });

      const [, , options] = mockAdd.mock.calls[0];
      expect(options.delay).toBe(0);
    });

    it("deve retornar null quando job.id for undefined", async () => {
      mockAdd.mockResolvedValue({ id: undefined });

      const jobId = await scheduleReminder({
        id: "act-3",
        reminderAt: new Date(Date.now() + 1000),
        assignedTo: null,
        createdBy: "user-4",
        subjectType: "opportunity",
        subjectId: "opp-1",
        title: "Follow-up",
      });

      expect(jobId).toBeNull();
    });
  });

  describe("cancelReminder", () => {
    it("não deve chamar getJob quando jobId for null", async () => {
      await cancelReminder(null);
      expect(mockGetJob).not.toHaveBeenCalled();
    });

    it("não deve chamar getJob quando jobId for undefined", async () => {
      await cancelReminder(undefined);
      expect(mockGetJob).not.toHaveBeenCalled();
    });

    it("deve chamar remove() quando job existir", async () => {
      mockGetJob.mockResolvedValue({ remove: mockRemove });
      mockRemove.mockResolvedValue(undefined);

      await cancelReminder("job-789");

      expect(mockGetJob).toHaveBeenCalledWith("job-789");
      expect(mockRemove).toHaveBeenCalledOnce();
    });

    it("não deve lançar quando job não existir na fila", async () => {
      mockGetJob.mockResolvedValue(null);

      await expect(cancelReminder("job-nao-existe")).resolves.toBeUndefined();
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
