/**
 * This package is used to create bots that can affect all parts of Nextcloud.
 *
 * @example
 * ```ts
 * import { UniversalNextcloudBot } from "@gradylink/unb";
 *
 * const unb = new UniversalNextcloudBot(
 *   process.env.NEXTCLOUD_URL,
 *   process.env.NEXTCLOUD_USERNAME,
 *   process.env.NEXTCLOUD_PASSWORD,
 * );
 * await unb.talk.setup();
 *
 * unb.talk.sendMessage(process.env.CHAT_TOKEN, "Hello, World!");
 * ```
 * @module unb
 */

import { UNBCalendar } from "./calendar.ts";
import { UNBFiles } from "./files.ts";
import { UNBTalk } from "./talk.ts";

/** A bot that authenticates against a Nextcloud instance and can talk to its Talk, Files, and Calendar APIs. */
export class UniversalNextcloudBot {
  url: string;
  username: string;
  password: string;
  talk: UNBTalk;
  files: UNBFiles;
  calendar: UNBCalendar;

  constructor(url: string, username: string, password: string) {
    this.url = url;
    this.username = username;
    this.password = password;

    this.talk = new UNBTalk(this.makeRequest.bind(this));
    this.files = new UNBFiles(this.makeRequest.bind(this), this.username);
    this.calendar = new UNBCalendar(this.makeRequest.bind(this), this.username);
  }

  /** Makes an authenticated request against the Nextcloud instance. */
  async makeRequest(
    method: string,
    path: string,
    body?: BodyInit,
    headers?: Record<string, string>,
  ): Promise<Response> {
    return await fetch(this.url + path, {
      method,
      body,
      headers: {
        Authorization: `Basic ${
          Buffer.from(`${this.username}:${this.password}`).toString("base64")
        }`,
        "content-type": "application/json",
        "OCS-APIRequest": "true",
        USER_AGENT: "ts-unb",
        ...headers,
      },
    });
  }
}
