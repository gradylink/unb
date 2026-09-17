/**
 * API for managing calendars and events in Nextcloud, via CalDAV.
 *
 * @module calendar
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

/** A CalDAV calendar. */
export type Calendar = {
  id: string;
  url: string;
  displayName: string;
  color?: string;
};

/** A single event (`VEVENT`) within a calendar. */
export type CalendarEvent = {
  uid: string;
  url: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
};

const eventFromIcs = (
  url: string,
  etag: string | undefined,
  ics: string,
): CalendarEvent | undefined => {
  const vevent = new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent(
    "vevent",
  );
  if (!vevent) return undefined;
  const event = new ICAL.Event(vevent);
  return {
    uid: event.uid,
    url,
    etag,
    summary: event.summary || undefined,
    description: event.description || undefined,
    location: event.location || undefined,
    start: event.startDate.toJSDate(),
    end: event.endDate ? event.endDate.toJSDate() : undefined,
    allDay: event.startDate.isDate,
  };
};

const eventToIcs = (data: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
}): string => {
  const calendar = new ICAL.Component(["vcalendar", [], []]);
  calendar.updatePropertyWithValue("version", "2.0");
  calendar.updatePropertyWithValue("prodid", "-//gradylink/unb//EN");

  const vevent = new ICAL.Component("vevent");
  const event = new ICAL.Event(vevent);
  event.uid = data.uid;
  event.summary = data.summary;
  if (data.description !== undefined) event.description = data.description;
  if (data.location !== undefined) event.location = data.location;
  event.startDate = ICAL.Time.fromJSDate(data.start, !data.allDay);
  event.startDate.isDate = Boolean(data.allDay);
  if (data.end) {
    event.endDate = ICAL.Time.fromJSDate(data.end, !data.allDay);
    event.endDate.isDate = Boolean(data.allDay);
  }
  calendar.addSubcomponent(vevent);
  return calendar.toString();
};

/** Client for managing calendars and events via CalDAV. */
export class UNBCalendar {
  makeRequest: MakeRequest;
  username: string;

  constructor(makeRequest: MakeRequest, username: string) {
    this.makeRequest = makeRequest;
    this.username = username;
  }

  private path(id: string): string {
    return collectionPath(this.username, id);
  }

  private eventPath(calendarId: string, uid: string): string {
    return resourcePath(this.username, calendarId, uid);
  }

  /** Lists the bot user's calendars. */
  async getCalendars(): Promise<Calendar[]> {
    const collections = await listCalendarCollections(
      this.makeRequest,
      this.username,
    );
    return collections
      .filter((c) => c.supportsEvents)
      .map(({ id, url, displayName, color }) => ({ id, url, displayName, color }));
  }

  /** Creates a new calendar. */
  async createCalendar(
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

  /** Deletes a calendar and all its events. */
  async deleteCalendar(id: string): Promise<void> {
    await this.makeRequest("DELETE", this.path(id));
  }

  /** Lists the events in a calendar. */
  async getEvents(calendarId: string): Promise<CalendarEvent[]> {
    const responses = await queryComponents(
      this.makeRequest,
      this.path(calendarId),
      "VEVENT",
    );
    return responses
      .map((r) => {
        const ics = getCalendarData(r);
        if (!ics) return undefined;
        return eventFromIcs(r.href, getEtag(r), ics);
      })
      .filter((event): event is CalendarEvent => event !== undefined);
  }

  /** Fetches a single event by uid. */
  async getEvent(calendarId: string, uid: string): Promise<CalendarEvent> {
    const path = this.eventPath(calendarId, uid);
    const response = await this.makeRequest("GET", path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch event "${uid}" (status ${response.status})`,
      );
    }
    const event = eventFromIcs(
      path,
      response.headers.get("etag") ?? undefined,
      await response.text(),
    );
    if (!event) {
      throw new Error(`Response for event "${uid}" contained no VEVENT`);
    }
    return event;
  }

  /**
   * Creates an event. If `replace` is false (the default) and an event with
   * this uid already exists, this throws instead of overwriting it.
   */
  async createEvent(
    calendarId: string,
    data: {
      uid?: string;
      summary: string;
      description?: string;
      location?: string;
      start: Date;
      end?: Date;
      allDay?: boolean;
    },
    options?: { replace?: boolean },
  ): Promise<CalendarEvent> {
    const uid = data.uid ?? crypto.randomUUID();
    const headers: Record<string, string> = {
      "content-type": "text/calendar; charset=utf-8",
    };
    if (!options?.replace) {
      headers["If-None-Match"] = "*";
    }
    const response = await this.makeRequest(
      "PUT",
      this.eventPath(calendarId, uid),
      eventToIcs({ ...data, uid }),
      headers,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to create event "${uid}" (status ${response.status})`,
      );
    }
    return {
      uid,
      url: this.eventPath(calendarId, uid),
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
      allDay: Boolean(data.allDay),
    };
  }

  /** Deletes an event. */
  async deleteEvent(calendarId: string, uid: string): Promise<void> {
    await this.makeRequest("DELETE", this.eventPath(calendarId, uid));
  }
}
