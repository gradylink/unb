/**
 * API for managing task lists and tasks in Nextcloud, via CalDAV.
 *
 * @module tasks
 */

import ICAL from "ical.js";
import {
  collectionPath,
  createCalendarCollection,
  getCalendarData,
  getEtag,
  listCalendarCollections,
  type MakeRequest,
  queryComponents,
  resourcePath,
} from "./caldav.ts";

/** A CalDAV task list (a calendar collection that supports `VTODO`). */
export type TaskList = {
  id: string;
  url: string;
  displayName: string;
  color?: string;
};

/** The completion state of a {@link Task}. */
export type TaskStatus =
  | "NEEDS-ACTION"
  | "IN-PROCESS"
  | "COMPLETED"
  | "CANCELLED";

/** A single task (`VTODO`) within a task list. */
export type Task = {
  uid: string;
  url: string;
  etag?: string;
  summary?: string;
  description?: string;
  due?: Date;
  completed?: Date;
  /** 0-100. */
  percentComplete?: number;
  status: TaskStatus;
  /** 0 (undefined) to 9 (lowest); 1 is highest priority. */
  priority?: number;
};

type TaskChanges = Partial<{
  summary: string;
  description: string;
  due: Date;
  status: TaskStatus;
  percentComplete: number;
  priority: number;
}>;

const taskFromComponent = (
  url: string,
  etag: string | undefined,
  vtodo: InstanceType<typeof ICAL.Component>,
): Task => ({
  uid: vtodo.getFirstPropertyValue("uid") as string,
  url,
  etag,
  summary: (vtodo.getFirstPropertyValue("summary") as string) || undefined,
  description:
    (vtodo.getFirstPropertyValue("description") as string) || undefined,
  due: (vtodo.getFirstPropertyValue("due") as
    | InstanceType<typeof ICAL.Time>
    | null)?.toJSDate(),
  completed: (vtodo.getFirstPropertyValue("completed") as
    | InstanceType<typeof ICAL.Time>
    | null)?.toJSDate(),
  percentComplete:
    (vtodo.getFirstPropertyValue("percent-complete") as number | null) ??
      undefined,
  status:
    (vtodo.getFirstPropertyValue("status") as TaskStatus | null) ??
      "NEEDS-ACTION",
  priority: (vtodo.getFirstPropertyValue("priority") as number | null) ??
    undefined,
});

const taskFromIcs = (
  url: string,
  etag: string | undefined,
  ics: string,
): Task | undefined => {
  const vtodo = new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent(
    "vtodo",
  );
  return vtodo ? taskFromComponent(url, etag, vtodo) : undefined;
};

const applyTaskChanges = (
  vtodo: InstanceType<typeof ICAL.Component>,
  changes: TaskChanges,
): void => {
  if (changes.summary !== undefined) {
    vtodo.updatePropertyWithValue("summary", changes.summary);
  }
  if (changes.description !== undefined) {
    vtodo.updatePropertyWithValue("description", changes.description);
  }
  if (changes.due !== undefined) {
    vtodo.updatePropertyWithValue("due", ICAL.Time.fromJSDate(changes.due, true));
  }
  if (changes.priority !== undefined) {
    vtodo.updatePropertyWithValue("priority", changes.priority);
  }
  if (changes.percentComplete !== undefined) {
    vtodo.updatePropertyWithValue("percent-complete", changes.percentComplete);
  }
  if (changes.status !== undefined) {
    vtodo.updatePropertyWithValue("status", changes.status);
    if (changes.status === "COMPLETED") {
      vtodo.updatePropertyWithValue(
        "completed",
        ICAL.Time.fromJSDate(new Date(), true),
      );
      if (changes.percentComplete === undefined) {
        vtodo.updatePropertyWithValue("percent-complete", 100);
      }
    } else {
      vtodo.removeProperty("completed");
    }
  }
};

const taskToIcs = (
  uid: string,
  changes: TaskChanges & { summary: string },
): string => {
  const calendar = new ICAL.Component(["vcalendar", [], []]);
  calendar.updatePropertyWithValue("version", "2.0");
  calendar.updatePropertyWithValue("prodid", "-//gradylink/unb//EN");

  const vtodo = new ICAL.Component("vtodo");
  vtodo.updatePropertyWithValue("uid", uid);
  vtodo.updatePropertyWithValue("status", "NEEDS-ACTION");
  applyTaskChanges(vtodo, changes);
  calendar.addSubcomponent(vtodo);
  return calendar.toString();
};

/** Client for managing task lists and tasks via CalDAV. */
export class UNBTasks {
  makeRequest: MakeRequest;
  username: string;

  constructor(makeRequest: MakeRequest, username: string) {
    this.makeRequest = makeRequest;
    this.username = username;
  }

  private path(id: string): string {
    return collectionPath(this.username, id);
  }

  private taskPath(taskListId: string, uid: string): string {
    return resourcePath(this.username, taskListId, uid);
  }

  /** Lists the bot user's task lists. */
  async getTaskLists(): Promise<TaskList[]> {
    const collections = await listCalendarCollections(
      this.makeRequest,
      this.username,
    );
    return collections
      .filter((c) => c.supportsTasks)
      .map(({ id, url, displayName, color }) => ({
        id,
        url,
        displayName,
        color,
      }));
  }

  /** Creates a new task list. */
  async createTaskList(
    id: string,
    displayName: string,
    color?: string,
  ): Promise<void> {
    await createCalendarCollection(
      this.makeRequest,
      this.username,
      id,
      displayName,
      color,
    );
  }

  /** Deletes a task list and all its tasks. */
  async deleteTaskList(id: string): Promise<void> {
    await this.makeRequest("DELETE", this.path(id));
  }

  /** Lists the tasks in a task list. */
  async getTasks(taskListId: string): Promise<Task[]> {
    const responses = await queryComponents(
      this.makeRequest,
      this.path(taskListId),
      "VTODO",
    );
    return responses
      .map((r) => {
        const ics = getCalendarData(r);
        if (!ics) return undefined;
        return taskFromIcs(r.href, getEtag(r), ics);
      })
      .filter((task): task is Task => task !== undefined);
  }

  /** Fetches a single task by uid. */
  async getTask(taskListId: string, uid: string): Promise<Task> {
    const path = this.taskPath(taskListId, uid);
    const response = await this.makeRequest("GET", path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch task "${uid}" (status ${response.status})`,
      );
    }
    const task = taskFromIcs(
      path,
      response.headers.get("etag") ?? undefined,
      await response.text(),
    );
    if (!task) {
      throw new Error(`Response for task "${uid}" contained no VTODO`);
    }
    return task;
  }

  /**
   * Creates a task. If `replace` is false (the default) and a task with this
   * uid already exists, this throws instead of overwriting it.
   */
  async createTask(
    taskListId: string,
    data: {
      uid?: string;
      summary: string;
      description?: string;
      due?: Date;
      priority?: number;
    },
    options?: { replace?: boolean },
  ): Promise<Task> {
    const uid = data.uid ?? crypto.randomUUID();
    const headers: Record<string, string> = {
      "content-type": "text/calendar; charset=utf-8",
    };
    if (!options?.replace) {
      headers["If-None-Match"] = "*";
    }
    const response = await this.makeRequest(
      "PUT",
      this.taskPath(taskListId, uid),
      taskToIcs(uid, data),
      headers,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to create task "${uid}" (status ${response.status})`,
      );
    }
    return this.getTask(taskListId, uid);
  }

  /** Updates a task's summary, description, due date, status, progress, or priority. */
  async updateTask(
    taskListId: string,
    uid: string,
    changes: TaskChanges,
  ): Promise<Task> {
    const path = this.taskPath(taskListId, uid);
    const response = await this.makeRequest("GET", path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch task "${uid}" (status ${response.status})`,
      );
    }
    const component = new ICAL.Component(ICAL.parse(await response.text()));
    const vtodo = component.getFirstSubcomponent("vtodo");
    if (!vtodo) {
      throw new Error(`Response for task "${uid}" contained no VTODO`);
    }
    applyTaskChanges(vtodo, changes);
    const putResponse = await this.makeRequest(
      "PUT",
      path,
      component.toString(),
      { "content-type": "text/calendar; charset=utf-8" },
    );
    if (!putResponse.ok) {
      throw new Error(
        `Failed to update task "${uid}" (status ${putResponse.status})`,
      );
    }
    return taskFromComponent(
      path,
      putResponse.headers.get("etag") ?? undefined,
      vtodo,
    );
  }

  /** Marks a task as completed. */
  async completeTask(taskListId: string, uid: string): Promise<Task> {
    return this.updateTask(taskListId, uid, { status: "COMPLETED" });
  }

  /** Deletes a task. */
  async deleteTask(taskListId: string, uid: string): Promise<void> {
    await this.makeRequest("DELETE", this.taskPath(taskListId, uid));
  }
}
