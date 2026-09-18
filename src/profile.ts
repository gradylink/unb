/**
 * API for reading and updating Nextcloud user accounts and profile pages.
 *
 * Nextcloud only allows a non-admin user to edit its own account — the
 * Provisioning API rejects attempts to edit another user's fields unless the
 * bot has admin or sub-admin rights over them, and profile visibility can
 * only ever be changed for the account making the request.
 *
 * @module profile
 */

import type { MakeRequest } from "./types.ts";

/** Who can see an account property, via the Provisioning API. */
export type AccountScope =
  | "v2-private"
  | "v2-local"
  | "v2-federated"
  | "v2-published";

/** Whether a field is shown on the public profile page. */
export type ProfileVisibility = "show" | "show_users_only" | "hide";

/** A profile-page field whose visibility can be configured. */
export type ProfileParamId =
  | "address"
  | "avatar"
  | "biography"
  | "displayname"
  | "headline"
  | "organisation"
  | "role"
  | "pronouns"
  | "email"
  | "phone"
  | "website"
  | "twitter"
  | "bluesky"
  | "fediverse";

/**
 * A field on the user's own account that can be updated with
 * {@link UNBProfile.updateOwnAccountField}.
 */
export type AccountField =
  | "displayname"
  | "email"
  | "password"
  | "notify_email"
  | "timezone"
  | "language"
  | "locale"
  | "first_day_of_week"
  | "phone"
  | "address"
  | "website"
  | "twitter"
  | "bluesky"
  | "fediverse"
  | "organisation"
  | "role"
  | "headline"
  | "biography"
  | "pronouns"
  | "birthdate"
  | "profile_enabled";

/**
 * A field whose visibility scope can be set with
 * {@link UNBProfile.setOwnFieldScope}.
 */
export type ScopableAccountField =
  | "address"
  | "avatar"
  | "biography"
  | "birthdate"
  | "displayname"
  | "email"
  | "fediverse"
  | "headline"
  | "organisation"
  | "phone"
  | "profile_enabled"
  | "pronouns"
  | "role"
  | "twitter"
  | "bluesky"
  | "website";

/** A user's storage quota. */
export type Quota = {
  free?: number;
  used?: number;
  total?: number;
  relative?: number;
  quota?: number | string;
};

/** Full account details for a user, as returned by the Provisioning API. */
export type Account = {
  id: string;
  enabled?: boolean;
  storageLocation?: string;
  lastLogin: number;
  firstLoginTimestamp: number;
  lastLoginTimestamp: number;
  backend: string;
  backendCapabilities: { setDisplayName: boolean; setPassword: boolean };
  subadmin: string[];
  quota: Quota;
  manager?: string;
  email: string | null;
  emailScope?: AccountScope;
  additional_mail: string[];
  additional_mailScope?: AccountScope[];
  displayname: string;
  displaynameScope?: AccountScope;
  "display-name": string;
  phone?: string;
  phoneScope?: AccountScope;
  address?: string;
  addressScope?: AccountScope;
  website?: string;
  websiteScope?: AccountScope;
  twitter?: string;
  twitterScope?: AccountScope;
  bluesky?: string;
  blueskyScope?: AccountScope;
  fediverse?: string;
  fediverseScope?: AccountScope;
  organisation?: string;
  organisationScope?: AccountScope;
  role?: string;
  roleScope?: AccountScope;
  headline?: string;
  headlineScope?: AccountScope;
  biography?: string;
  biographyScope?: AccountScope;
  profile_enabled?: string;
  profile_enabledScope?: AccountScope;
  pronouns?: string;
  pronounsScope?: AccountScope;
  avatarScope?: AccountScope;
  groups: string[];
  language: string;
  locale: string;
  timezone?: string;
  notify_email: string | null;
};

/** An action link (e.g. email, phone, website) shown on a profile page. */
export type ProfileAction = {
  id: string;
  icon: string;
  title: string;
  target: string | null;
};

/** The public profile page data for a user. */
export type Profile = {
  userId: string;
  displayname?: string | null;
  address?: string | null;
  biography?: string | null;
  headline?: string | null;
  organisation?: string | null;
  role?: string | null;
  pronouns?: string | null;
  isUserAvatarVisible: boolean;
  actions: ProfileAction[];
  /** Timezone identifier, e.g. `Europe/Berlin`. */
  timezone: string;
  /** Offset from UTC in seconds; negative when behind UTC. */
  timezoneOffset: number;
};

/** An action link (e.g. email, phone, website) shown on a hovercard. */
export type HovercardAction = {
  title: string;
  icon: string;
  hyperlink: string;
  appId: string;
};

/** The condensed account details shown on a user's hovercard. */
export type Hovercard = {
  userId: string;
  displayName: string;
  actions: HovercardAction[];
};

/** Client for reading and updating Nextcloud accounts and profile pages. */
export class UNBProfile {
  makeRequest: MakeRequest;
  username: string;

  constructor(makeRequest: MakeRequest, username: string) {
    this.makeRequest = makeRequest;
    this.username = username;
  }

  private async ocs<T>(
    method: string,
    path: string,
    body?: BodyInit,
  ): Promise<T> {
    const response = await this.makeRequest(
      method,
      `${path}${path.includes("?") ? "&" : "?"}format=json`,
      body,
    );
    if (!response.ok) {
      throw new Error(
        `Profile request "${method} ${path}" failed (status ${response.status})`,
      );
    }
    return (await response.json()).ocs.data;
  }

  /** Fetches the bot's own account details. */
  getOwnAccount(): Promise<Account> {
    return this.ocs("GET", "/ocs/v2.php/cloud/user");
  }

  /** Fetches another user's account details. Requires admin or sub-admin rights over that user. */
  getAccount(userId: string): Promise<Account> {
    return this.ocs(
      "GET",
      `/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}`,
    );
  }

  /** Updates a field on the bot's own account (the only account it can edit fields on). */
  updateOwnAccountField(key: AccountField, value: string): Promise<void> {
    return this.updateAccountField(this.username, key, value);
  }

  /** Sets the visibility scope of one of the bot's own account fields. */
  setOwnFieldScope(
    field: ScopableAccountField,
    scope: AccountScope,
  ): Promise<void> {
    return this.updateAccountField(this.username, `${field}Scope`, scope);
  }

  /**
   * Updates a field on another user's account. Requires the bot to have
   * admin or sub-admin rights over that user; a narrower set of fields is
   * editable this way than on the bot's own account.
   */
  updateOtherAccountField(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    return this.updateAccountField(userId, key, value);
  }

  private updateAccountField(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    return this.ocs(
      "PUT",
      `/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}`,
      JSON.stringify({ key, value }),
    );
  }

  /** Fetches the public profile page data for a user. */
  getProfile(userId: string): Promise<Profile> {
    return this.ocs("GET", `/ocs/v2.php/profile/${encodeURIComponent(userId)}`);
  }

  /** Fetches the bot's own public profile page data. */
  getOwnProfile(): Promise<Profile> {
    return this.getProfile(this.username);
  }

  /** Fetches the condensed account details (name and action links) shown on a user's hovercard. */
  getHovercard(userId: string): Promise<Hovercard> {
    return this.ocs(
      "GET",
      `/ocs/v2.php/hovercard/v1/${encodeURIComponent(userId)}`,
    );
  }

  /**
   * Sets whether a field is shown on the bot's own public profile page.
   * Nextcloud only allows editing your own profile's visibility settings.
   */
  setProfileFieldVisibility(
    paramId: ProfileParamId,
    visibility: ProfileVisibility,
  ): Promise<void> {
    return this.ocs(
      "PUT",
      `/ocs/v2.php/profile/${encodeURIComponent(this.username)}`,
      JSON.stringify({ paramId, visibility }),
    );
  }
}
