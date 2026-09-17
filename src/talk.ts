/**
 * API for Nextcloud Talk.
 *
 * @module talk
 */

import type { RichObjectParam } from "./types.ts";

/** The kind of conversation a {@link Room} represents. */
export enum ConversationType {
  OneToOne = 1,
  Group = 2,
  Public = 3,
  Changelog = 4,
  /** @deprecated Replaced by {@link ConversationType.OneToOne} conversations that keep history. */
  FormerOneToOne = 5,
  NoteToSelf = 6,
}

/** A participant's role within a conversation. */
export enum ParticipantType {
  Owner = 1,
  Moderator = 2,
  User = 3,
  Guest = 4,
  UserSelfJoined = 5,
  GuestModerator = 6,
}

/** How often a participant is notified about a conversation. */
export enum NotificationLevel {
  Default = 0,
  Always = 1,
  Mention = 2,
  Never = 3,
}

/** Whether non-moderators are held in the lobby before a call starts. */
export enum LobbyState {
  NoLobby = 0,
  NonModeratorsRestricted = 1,
}

/** Whether dial-in via SIP is available for a conversation. */
export enum SipEnabled {
  Disabled = 0,
  Enabled = 1,
  EnabledWithoutPin = 2,
}

/** The current call recording state of a conversation. */
export enum CallRecordingStatus {
  None = 0,
  Video = 1,
  Audio = 2,
  VideoStopping = 3,
  AudioStopping = 4,
  Failed = 5,
}

/** Whether participants must consent before a call recording starts. */
export enum RecordingConsent {
  Off = 0,
  Required = 1,
}

/** Who is allowed to ping the whole conversation. */
export enum MentionPermissions {
  Everyone = 0,
  ModeratorsOnly = 1,
}

/** How breakout rooms are assigned for a conversation. */
export enum BreakoutRoomMode {
  NotConfigured = 0,
  Automatic = 1,
  Manual = 2,
  Free = 3,
}

/** Whether breakout rooms are currently open. */
export enum BreakoutRoomStatus {
  Stopped = 0,
  Started = 1,
}

/** A Nextcloud Talk conversation. */
export type Room = {
  id: number;
  token: string;
  type: ConversationType;
  name: string;
  displayName: string;
  description: string;
  participantType: ParticipantType;
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
  notificationLevel: NotificationLevel;
  lobbyState: LobbyState;
  lobbyTimer: number;
  sipEnabled: SipEnabled;
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
  breakoutRoomMode: BreakoutRoomMode;
  breakoutRoomStatus: BreakoutRoomStatus;
  status: string;
  statusIcon?: string;
  statusMessage?: string;
  statusClearAt?: number;
  avatarVersion: string;
  isCustomAvatar: boolean;
  callStartTime: number;
  callRecording: CallRecordingStatus;
  recordingConsent: RecordingConsent;
  mentionPermissions: MentionPermissions;
  isArchived: boolean;
};

/** A single message within a Talk conversation. */
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

/** A participant in a Talk conversation. */
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
  participantType: ParticipantType;
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

/** Whether a poll's results are visible before it closes. */
export enum PollResultMode {
  Hidden = 0,
  Public = 1,
}

/** A file rich object parameter attached to a {@link Message}. */
export type FileAttachment = RichObjectParam & {
  mimetype: string;
  width?: number;
  height?: number;
  size?: number;
};

/** Client for the Nextcloud Talk (Spreed) API. */
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

  /** Sends a chat message to a conversation. */
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

  /** Deletes a chat message. */
  async deleteMessage(token: string, id: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${id}?format=json`,
    );
  }

  /** Edits the text of an existing chat message. */
  async editMessage(token: string, id: number, newMessage: string) {
    await this.makeRequest(
      "PUT",
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${id}?format=json`,
      JSON.stringify({ message: newMessage }),
    );
  }

  /** Lists the participants of a conversation. */
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

  /** Marks the bot's session as active in a conversation. */
  async setActive(token: string) {
    await this.makeRequest(
      "POST",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants/active`,
    );
  }

  /** Sets, adds, or removes permissions for a conversation attendee. */
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

  /** Adds a user as a participant of a conversation. */
  async addParticipant(token: string, user: string) {
    await this.makeRequest(
      "POST",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants?format=json&includeStatus=true`,
      JSON.stringify({ newParticipant: user, source: "users" }),
    );
  }

  /** Demotes a moderator to a regular participant. */
  async demoteMod(token: string, attendeeId: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/moderators?format=json&attendeeId=${attendeeId}`,
    );
  }

  /** Removes an attendee from a conversation. */
  async removeAttendee(token: string, attendeeId: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/attendees?attendeeId=${attendeeId}`,
    );
  }

  /** Creates a poll in a conversation and returns its id. */
  async createPoll(
    token: string,
    data: {
      question: string;
      options: string[];
      resultMode: PollResultMode;
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

  /** Closes a poll, preventing further votes. */
  async closePoll(token: string, id: number) {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${id}?format=json`,
    );
  }

  /** Extracts the file attachment from a message's rich object parameters, if any. */
  getAttachment(
    messageParameters: Record<string, RichObjectParam>,
  ): FileAttachment | undefined {
    const file = messageParameters.file as FileAttachment | undefined;
    return file?.type === "file" ? file : undefined;
  }

  /** Same as {@link getAttachment}, but only returns image attachments. */
  getImageAttachment(
    messageParameters: Record<string, RichObjectParam>,
  ): FileAttachment | undefined {
    const file = this.getAttachment(messageParameters);
    return file?.mimetype.startsWith("image/") ? file : undefined;
  }

  /** Fetches a preview of a file attachment and returns it as a data URL. */
  async fetchPreviewDataUrl(file: FileAttachment): Promise<string> {
    const width = file.width ?? 512;
    const height = file.height ?? 512;
    const response = await this.makeRequest(
      "GET",
      `/core/preview?fileId=${file.id}&x=${width}&y=${height}`,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    return `data:${file.mimetype};base64,${
      Buffer.from(bytes).toString("base64")
    }`;
  }
}
