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

import { UNBTalk } from "./talk.ts";

export class UniversalNextcloudBot {
  url: string;
  username: string;
  password: string;
  talk: UNBTalk;

  constructor(url: string, username: string, password: string) {
    this.url = url;
    this.username = username;
    this.password = password;

    this.talk = new UNBTalk(this.makeRequest.bind(this));
  }

  async makeRequest(
    method: string,
    path: string,
    body?: string,
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
      },
    });
  }
}
