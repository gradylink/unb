import { XMLParser } from "fast-xml-parser";
import type { MakeRequest } from "./types.ts";

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

export const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// deno-lint-ignore no-explicit-any
export type MultistatusResponse = Record<string, any> & { href: string };

export const parseMultistatus = (xml: string): MultistatusResponse[] =>
  asArray(xmlParser.parse(xml).multistatus?.response);

export const collectionHomePath = (username: string): string =>
  `/remote.php/dav/calendars/${encodeURIComponent(username)}/`;

export const collectionPath = (username: string, id: string): string =>
  `${collectionHomePath(username)}${encodeURIComponent(id)}/`;

export const resourcePath = (
  username: string,
  collectionId: string,
  uid: string,
): string =>
  `${collectionPath(username, collectionId)}${encodeURIComponent(uid)}.ics`;

/** A CalDAV collection that can hold events, tasks, or both. */
export type CalendarCollection = {
  id: string;
  url: string;
  displayName: string;
  color?: string;
  supportsEvents: boolean;
  supportsTasks: boolean;
};

export const listCalendarCollections = async (
  makeRequest: MakeRequest,
  username: string,
): Promise<CalendarCollection[]> => {
  const response = await makeRequest(
    "PROPFIND",
    collectionHomePath(username),
    `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/">
  <prop>
    <resourcetype />
    <displayname />
    <ic:calendar-color />
    <cal:supported-calendar-component-set />
  </prop>
</propfind>`,
    { "content-type": "application/xml; charset=utf-8", Depth: "1" },
  );
  const responses = parseMultistatus(await response.text());
  return responses
    .filter((r) => r.propstat?.prop?.resourcetype?.calendar !== undefined)
    .map((r) => {
      const components = asArray(
        r.propstat?.prop?.["supported-calendar-component-set"]?.comp,
      ).map((c) => c?.["@_name"]);
      return {
        id: decodeURIComponent(
          String(r.href).replace(/\/$/, "").split("/").pop() ?? "",
        ),
        url: r.href,
        displayName: r.propstat?.prop?.displayname ?? "",
        color: r.propstat?.prop?.["calendar-color"],
        supportsEvents: components.length === 0 ||
          components.includes("VEVENT"),
        supportsTasks: components.length === 0 || components.includes("VTODO"),
      };
    });
};

export const createCalendarCollection = async (
  makeRequest: MakeRequest,
  username: string,
  id: string,
  displayName: string,
  color?: string,
): Promise<void> => {
  const response = await makeRequest(
    "MKCALENDAR",
    collectionPath(username, id),
    `<?xml version="1.0" encoding="utf-8" ?>
<mkcalendar xmlns="DAV:" xmlns:ic="http://apple.com/ns/ical/">
  <set>
    <prop>
      <displayname>${escapeXml(displayName)}</displayname>
      ${
      color ? `<ic:calendar-color>${escapeXml(color)}</ic:calendar-color>` : ""
    }
    </prop>
  </set>
</mkcalendar>`,
    { "content-type": "application/xml; charset=utf-8" },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to create calendar "${id}" (status ${response.status})`,
    );
  }
};

/** Runs a `calendar-query` REPORT for a single component type (`VEVENT`/`VTODO`) in a collection. */
export const queryComponents = async (
  makeRequest: MakeRequest,
  path: string,
  componentName: "VEVENT" | "VTODO",
): Promise<MultistatusResponse[]> => {
  const response = await makeRequest(
    "REPORT",
    path,
    `<?xml version="1.0" encoding="utf-8" ?>
<calendar-query xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <calendar-data />
  </d:prop>
  <filter>
    <comp-filter name="VCALENDAR">
      <comp-filter name="${componentName}" />
    </comp-filter>
  </filter>
</calendar-query>`,
    { "content-type": "application/xml; charset=utf-8", Depth: "1" },
  );
  return parseMultistatus(await response.text());
};

export const getCalendarData = (
  r: MultistatusResponse,
): string | undefined => {
  const data = r.propstat?.prop?.["calendar-data"];
  return data === undefined ? undefined : String(data);
};

export const getEtag = (r: MultistatusResponse): string | undefined =>
  r.propstat?.prop?.getetag;
