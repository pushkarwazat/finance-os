import { Router } from "express";
import { randomUUID } from "crypto";
import {
  ListCloseTasksQueryParams,
  CreateCloseTaskBody,
  GetCloseTaskParams,
  UpdateCloseTaskParams,
  UpdateCloseTaskBody,
  GetCloseSummaryQueryParams,
} from "@workspace/api-zod";
import { MOCK_CLOSE_TASKS } from "../data/fixtures.js";

const router = Router();
const tasks = [...MOCK_CLOSE_TASKS];

router.get("/close/tasks", (req, res) => {
  const parsed = ListCloseTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { status, period, fiscalYear, assigneeId } = parsed.data;
  let filtered = tasks;
  if (status) filtered = filtered.filter((t) => t.status === status);
  if (period) filtered = filtered.filter((t) => t.closePeriod === period);
  if (fiscalYear) filtered = filtered.filter((t) => t.fiscalYear === fiscalYear);
  if (assigneeId) filtered = filtered.filter((t) => t.assigneeId === assigneeId);
  res.json({ data: filtered, total: filtered.length });
});

router.post("/close/tasks", (req, res) => {
  const parsed = CreateCloseTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const newTask = {
    id: randomUUID(),
    status: "pending" as const,
    comments: 0,
    attachments: 0,
    dependencies: parsed.data.dependencies ?? [],
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...parsed.data,
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

router.get("/close/tasks/:id", (req, res) => {
  const parsed = GetCloseTaskParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const task = tasks.find((t) => t.id === parsed.data.id);
  if (!task) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Task not found" });
    return;
  }
  res.json(task);
});

router.patch("/close/tasks/:id", (req, res) => {
  const paramsParsed = UpdateCloseTaskParams.safeParse(req.params);
  const bodyParsed = UpdateCloseTaskBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const idx = tasks.findIndex((t) => t.id === paramsParsed.data.id);
  if (idx === -1) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Task not found" });
    return;
  }
  const updated = {
    ...tasks[idx],
    ...Object.fromEntries(Object.entries(bodyParsed.data).filter(([, v]) => v !== undefined)),
    updatedAt: new Date().toISOString(),
    completedAt: bodyParsed.data.status === "complete" ? new Date().toISOString() : tasks[idx].completedAt,
  };
  tasks[idx] = updated;
  res.json(updated);
});

router.get("/close/summary", (req, res) => {
  const parsed = GetCloseSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { period = "Q4", fiscalYear = 2025 } = parsed.data;
  const filtered = tasks.filter(
    (t) => t.closePeriod === period && t.fiscalYear === fiscalYear
  );
  const byStatus: Record<string, number> = {};
  for (const t of filtered) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }
  const complete = filtered.filter((t) => t.status === "complete").length;
  const total = filtered.length;
  const today = new Date();
  const overdue = filtered.filter(
    (t) => t.status !== "complete" && new Date(t.dueDate) < today
  ).length;
  const critical = filtered.filter(
    (t) => t.priority === "critical" && t.status !== "complete"
  ).length;
  res.json({
    period,
    fiscalYear,
    totalTasks: total,
    byStatus,
    overdueTasks: overdue,
    completionRate: total > 0 ? complete / total : 0,
    criticalOpen: critical,
  });
});

export default router;
