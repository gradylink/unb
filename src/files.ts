/**
 * API for managing files, folders, and shares in Nextcloud.
 *
 * @module files
 */

/** Who or what a {@link Share} is shared with. */
export enum ShareType {
  User = 0,
  Group = 1,
  PublicLink = 3,
  Email = 4,
  FederatedCloudShare = 6,
  Circle = 7,
  /** Shared into a Talk conversation. */
  Room = 10,
}

/** A share of a file or folder. */
export type Share = {
  id: number;
  shareType: ShareType;
  uidOwner: string;
  displayNameOwner: string;
  permissions: number;
  path: string;
  itemType: "file" | "folder";
  mimetype: string;
  shareWith?: string;
  shareWithDisplayName?: string;
  token?: string;
  url?: string;
  expiration?: string;
  label?: string;
  note?: string;
  hideDownload?: boolean;
};

/** Client for managing files, folders, and shares via WebDAV and the Files Sharing API. */
export class UNBFiles {
  makeRequest: (
    method: string,
    path: string,
    body?: BodyInit,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  username: string;

  constructor(
    makeRequest: (
      method: string,
      path: string,
      body?: BodyInit,
      headers?: Record<string, string>,
    ) => Promise<Response>,
    username: string,
  ) {
    this.makeRequest = makeRequest;
    this.username = username;
  }

  private davPath(path: string): string {
    const parts = path.split("/").filter(Boolean).map(encodeURIComponent);
    return `/remote.php/dav/files/${encodeURIComponent(this.username)}/${
      parts.join("/")
    }`;
  }

  /** Reads a file's contents. */
  async readFile(path: string): Promise<ArrayBuffer> {
    const response = await this.makeRequest("GET", this.davPath(path));
    return await response.arrayBuffer();
  }

  /** Checks whether a file or folder exists. */
  async exists(path: string): Promise<boolean> {
    const response = await this.makeRequest("HEAD", this.davPath(path));
    return response.ok;
  }

  /**
   * Creates a file. If `replace` is false (the default) and the file already
   * exists, this throws instead of overwriting it.
   */
  async createFile(
    path: string,
    content: BodyInit,
    options?: { contentType?: string; replace?: boolean },
  ): Promise<void> {
    const headers: Record<string, string> = {
      "content-type": options?.contentType ?? "application/octet-stream",
    };
    if (!options?.replace) {
      headers["If-None-Match"] = "*";
    }
    const response = await this.makeRequest(
      "PUT",
      this.davPath(path),
      content,
      headers,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to create file at "${path}" (status ${response.status})`,
      );
    }
  }

  /** Deletes a file. */
  async deleteFile(path: string): Promise<void> {
    await this.makeRequest("DELETE", this.davPath(path));
  }

  /** Creates a folder. Parent folders must already exist. */
  async createFolder(path: string): Promise<void> {
    await this.makeRequest("MKCOL", this.davPath(path));
  }

  /** Deletes a folder and everything inside it. */
  async deleteFolder(path: string): Promise<void> {
    await this.makeRequest("DELETE", this.davPath(path));
  }

  /** Moves (or renames) a file or folder. */
  async move(
    sourcePath: string,
    destinationPath: string,
    overwrite = false,
  ): Promise<void> {
    await this.makeRequest("MOVE", this.davPath(sourcePath), undefined, {
      Destination: this.davPath(destinationPath),
      Overwrite: overwrite ? "T" : "F",
    });
  }

  /** Copies a file or folder. */
  async copy(
    sourcePath: string,
    destinationPath: string,
    overwrite = false,
  ): Promise<void> {
    await this.makeRequest("COPY", this.davPath(sourcePath), undefined, {
      Destination: this.davPath(destinationPath),
      Overwrite: overwrite ? "T" : "F",
    });
  }

  /** Renames a file or folder in place, keeping it in the same parent folder. */
  async rename(path: string, newName: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf("/") + 1);
    await this.move(path, parent + newName);
  }

  /** Creates a share for a file or folder. */
  async createShare(data: {
    path: string;
    shareType: ShareType;
    shareWith?: string;
    permissions?: number;
    password?: string;
    expireDate?: string;
    note?: string;
    label?: string;
  }): Promise<Share> {
    return (
      await (
        await this.makeRequest(
          "POST",
          "/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json",
          JSON.stringify(data),
        )
      ).json()
    ).ocs.data;
  }

  /** Lists shares, optionally filtered to a single file or folder. */
  async getShares(path?: string): Promise<Share[]> {
    const query = path ? `&path=${encodeURIComponent(path)}` : "";
    return (
      await (
        await this.makeRequest(
          "GET",
          `/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json${query}`,
        )
      ).json()
    ).ocs.data;
  }

  /** Fetches a single share by id. */
  async getShare(id: number): Promise<Share> {
    return (
      await (
        await this.makeRequest(
          "GET",
          `/ocs/v2.php/apps/files_sharing/api/v1/shares/${id}?format=json`,
        )
      ).json()
    ).ocs.data;
  }

  /** Updates a share's permissions, password, expiration, note, label, or download visibility. */
  async updateShare(
    id: number,
    data: {
      permissions?: number;
      password?: string;
      expireDate?: string;
      note?: string;
      label?: string;
      hideDownload?: boolean;
    },
  ): Promise<Share> {
    return (
      await (
        await this.makeRequest(
          "PUT",
          `/ocs/v2.php/apps/files_sharing/api/v1/shares/${id}?format=json`,
          JSON.stringify(data),
        )
      ).json()
    ).ocs.data;
  }

  /** Deletes a share. */
  async deleteShare(id: number): Promise<void> {
    await this.makeRequest(
      "DELETE",
      `/ocs/v2.php/apps/files_sharing/api/v1/shares/${id}?format=json`,
    );
  }
}
