import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}));

// Mock do logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock das funções da fila
const mockGetJob = vi.fn();
const mockScheduleReminder = vi.fn();

vi.mock("./queues/activity-reminders", () => ({
  activityReminderQueue: {
    getJob: mockGetJob,
  },
  scheduleReminder: mockScheduleReminder,
  ACTIVITY_REMINDERS: "activity-reminders",
}));

const { reenqueuePendingReminders } = await import("./boot");

const makeActivity = (overrides: Partial<{
  id: string;
  reminderAt: Date;
  reminderJobId: string | null;
  assignedTo: string | null;
  createdBy: string;
  subjectType: string;
  subjectId: string;
  title: string;
}> = {}) => ({
  id: "act-1",
  reminderAt: new Date(Date.now() + 60_000),
  reminderJobId: null,
  assignedTo: "user-1",
  createdBy: "user-2",
  subjectType: "lead",
  subjectId: "lead-1",
  title: "Ligar para cliente",
  ...overrides,
});

describe("reenqueuePendingReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve agendar activities sem reminderJobId", async () => {
    const activity = makeActivity({ reminderJobId: null });
    mockFindMany.mockResolvedValue([activity]);
    mockScheduleReminder.mockResolvedValue("new-job-id");
    mockUpdate.mockResolvedValue({});

    await reenqueuePendingReminders();

    expect(mockScheduleReminder).toHaveBeenCalledOnce();
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: activity.id })
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: activity.id },
      data: { reminderJobId: "new-job-id" },
    });
  });

  it("deve skipar activities cujo job ainda existe na fila", async () => {
    const activity = makeActivity({ reminderJobId: "existing-job" });
    mockFindMany.mockResolvedValue([activity]);
    mockGetJob.mockResolvedValue({ id: "existing-job" }); // job existe

    await reenqueuePendingReminders();

    expect(mockGetJob).toHaveBeenCalledWith("existing-job");
    expect(mockScheduleReminder).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("deve re-agendar activities com reminderJobId cujo job não existe mais na fila", async () => {
    const activity = makeActivity({ reminderJobId: "stale-job" });
    mockFindMany.mockResolvedValue([activity]);
    mockGetJob.mockResolvedValue(null); // job não existe mais
    mockScheduleReminder.mockResolvedValue("renewed-job-id");
    mockUpdate.mockResolvedValue({});

    await reenqueuePendingReminders();

    expect(mockGetJob).toHaveBeenCalledWith("stale-job");
    expect(mockScheduleReminder).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: activity.id },
      data: { reminderJobId: "renewed-job-id" },
    });
  });

  it("deve processar múltiplas activities corretamente", async () => {
    const actNoJob = makeActivity({ id: "act-no-job", reminderJobId: null });
    const actExistingJob = makeActivity({ id: "act-existing", reminderJobId: "existing-job" });
    const actStaleJob = makeActivity({ id: "act-stale", reminderJobId: "stale-job" });

    mockFindMany.mockResolvedValue([actNoJob, actExistingJob, actStaleJob]);
    mockGetJob
      .mockResolvedValueOnce({ id: "existing-job" }) // actExistingJob → skip
      .mockResolvedValueOnce(null);                   // actStaleJob → re-schedule
    mockScheduleReminder.mockResolvedValue("new-id");
    mockUpdate.mockResolvedValue({});

    await reenqueuePendingReminders();

    // actNoJob e actStaleJob devem ser agendados
    expect(mockScheduleReminder).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("não deve atualizar activity quando scheduleReminder retornar null", async () => {
    const activity = makeActivity({ reminderJobId: null });
    mockFindMany.mockResolvedValue([activity]);
    mockScheduleReminder.mockResolvedValue(null);

    await reenqueuePendingReminders();

    expect(mockScheduleReminder).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
