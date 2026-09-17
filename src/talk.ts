/**
 * API for Nextcloud Talk.
 *
 * @module talk
 */

import type { RichObjectParam } from "./types.ts";

export type Room = {
  id: number;
  token: string;
  type: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  displayName: string;
  description: string;
  participantType: 1 | 2 | 3 | 4 | 5 | 6;
  attendeeId: number;
  attendeePin: string;
  actorType:
    | "users"
    | "federated_users"
    | "groups"
    | "circles"
    | "guests"
    | "emails";
  actorId: string;
  permissions: number;
  attendeePermissions: number;
  callPermissions: number;
  defaultPermissions: number;
  participantFlags: number;
  readOnly: number;
  listable: number;
  messageExpiration: number;
  lastPing: number;
  sessionId: string;
  hasPassword: boolean;
  hasCall: boolean;
  callFlag: number;
  canStartCall: boolean;
  canDeleteConversation: boolean;
  canLeaveConversation: boolean;
  lastActivity: number;
  isFavorite: boolean;
  notificationLevel: 0 | 1 | 2 | 3;
  lobbyState: 0 | 1;
  lobbyTimer: number;
  sipEnabled: 0 | 1 | 2;
  canEnableSIP: number;
  unreadMessages: number;
  unreadMention: boolean;
  unreadMentionDirect: boolean;
  lastReadMessage: number;
  lastCommonReadMessage: number;
  lastMessage: Message;
  objectType:
    | "file"
    | "share:password"
    | "room"
    | "phone"
    | "sample"
    | "event"
    | "extended_conversation";
  objectId: string;
  breakoutRoomMode: 0 | 1 | 2 | 3;
  breakoutRoomStatus: 0 | 1;
  status: string;
  statusIcon?: string;
  statusMessage?: string;
  statusClearAt?: number;
  avatarVersion: string;
  isCustomAvatar: boolean;
  callStartTime: number;
  callRecording: 0 | 1 | 2 | 3 | 4 | 5;
  recordingConsent: 0 | 1;
  mentionPermissions: 0 | 1;
  isArchived: boolean;
};

export type Message = {
  id: number;
  token: string;
  actorType:
    | "users"
    | "federated_users"
    | "groups"
    | "circles"
    | "guests"
    | "emails";
  actorId: string;
  actorDisplayName: string;
  timestamp: number;
  systemMessage: string;
  messageType: "comment" | "system" | "comment_deleted" | "command";
  isReplyable: boolean;
  referenceId: string;
  message: string;
  messageParameters: Record<string, RichObjectParam>;
  expirationTimestamp: number;
  parent?: Message;
  reactions?: number[];
  reactionsSelf?: string[];
  markdown?: boolean;
  lastEditActorType?:
    | "users"
    | "federated_users"
    | "groups"
    | "circles"
    | "guests"
    | "emails";
  lastEditActorId?: string;
  lastEditActorDisplayName?: string;
  lastEditTimestamp?: number;
  silent?: boolean;
};

export type Participant = {
  attendeeId: number;
  actorType:
    | "users"
    | "federated_users"
    | "groups"
    | "circles"
    | "guests"
    | "emails";
  actorId: string;
  displayName: string;
  participantType: 1 | 2 | 3 | 4 | 5 | 6;
  lastPing: number;
  inCall: number;
  permissions: number;
  attendeePermissions: number;
  sessionIds: string[];
  status: string;
  statusIcon: string;
  statusMessage: string;
  roomToken?: string;
  phoneNumber?: string;
  callId?: string;
};

export class UNBTalk {
  makeRequest: (
    method: string,
    path: string,
    body?: string,
  ) => Promise<Response>;
  rooms: { [token: string]: Room } = {};

  constructor(
    makeRequest: (
      method: string,
      path: string,
      body?: string,
    ) => Promise<Response>,
  ) {
    this.makeRequest = makeRequest;
  }

  /** Initalizes variables required for some functions. */
  async setup() {
    this.rooms = (
      (
        await (
          await this.makeRequest(
            "GET",
            "/ocs/v2.php/apps/spreed/api/v4/room?format=json",
          )
        ).json()
      ).ocs.data as Room[]
    ).reduce(
      (a, room) => {
        a[room.token] = room;
        return a;
      },
      {} as { [token: string]: Room },
    );
  }

  async sendMessage(token: string, msg: string, replyId?: number) {
    await this.makeRequest(
      "POST",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}?format=json`,
      JSON.stringify({
        message: msg,
        replyTo: replyId !== undefined ? replyId : 0,
      }),
    );
  }

  /** This should be called as often as possible. */
  async getNewMessages(token: string): Promise<Message[]> {
    const res = await this.makeRequest(
      "GET",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}?lookIntoFuture=1&setReadMarker=1&format=json&lastKnownMessageId=${
        this.rooms[token].lastReadMessage || 0
      }`,
    );
    if (res.status === 200) {
      this.rooms[token].lastReadMessage = Number(
        res.headers.get("x-chat-last-given"),
      );
      return (await res.json()).ocs.data;
    }
    return [];
  }

  async deleteMessage(token: string, id: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${id}?format=json`,
    );
  }

  async editMessage(token: string, id: number, newMessage: string) {
    await this.makeRequest(
      "PUT",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${id}?format=json`,
      JSON.stringify({ message: newMessage }),
    );
  }

  async getParticipants(token: string): Promise<Participant[]> {
    return (
      await (
        await this.makeRequest(
          "GET",
          `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants?format=json&includeStatus=true`,
        )
      ).json()
    ).ocs.data;
  }

  async setActive(token: string) {
    await this.makeRequest(
      "POST",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants/active`,
    );
  }

  async setPerms(
    token: string,
    data: {
      attendeeId: number;
      method: "set" | "add" | "remove";
      permissions: number;
    },
  ) {
    await this.makeRequest(
      "PUT",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/attendees/permissions`,
      JSON.stringify(data),
    );
  }

  async addParticipant(token: string, user: string) {
    await this.makeRequest(
      "POST",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants?format=json&includeStatus=true`,
      JSON.stringify({ newParticipant: user, source: "users" }),
    );
  }

  async demoteMod(token: string, attendeeId: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/moderators?format=json&attendeeId=${attendeeId}`,
    );
  }

  async removeAttendee(token: string, attendeeId: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/attendees?attendeeId=${attendeeId}`,
    );
  }

  async createPoll(
    token: string,
    data: {
      question: string;
      options: string[];
      resultMode: 0 | 1;
      maxVotes: number;
      draft: boolean;
    },
  ): Promise<number> {
    return (
      await (
        await this.makeRequest(
          "POST",
          `/ocs/v2.php/apps/spreed/api/v1/poll/${token}?format=json`,
          JSON.stringify(data),
        )
      ).json()
    ).ocs.data.id;
  }

  async closePoll(token: string, id: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${id}?format=json`,
    );
  }
}
