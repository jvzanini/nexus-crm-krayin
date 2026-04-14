import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const AUTOMATION_EXECUTE_QUEUE = "automation-execute";
export const automationQueue = new Queue(AUTOMATION_EXECUTE_QUEUE, { connection: redis });
