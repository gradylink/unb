/**
 * API for Nextcloud Notes.
 *
 * @module notes
 */

import type { MakeRequest } from "./types.ts";

/** A field that can be left out of a {@link Note} in a list response, to save bandwidth. */
export type NoteField = "title" | "category" | "content" | "favorite";

/** A note managed by the Notes app. */
export type Note = {
  id: number;
  etag: string;
  readonly: boolean;
  title: string;
  category: string;
  favorite: boolean;
  modified: number;
  content?: string;
  error?: boolean;
  errorMessage?: string;
};

/** A page of notes returned by a chunked listing. */
export type NotesPage = {
  notes: Note[];
  cursor?: string;
  pending: number;
};

/** The Notes app's per-user settings. */
export type NotesSettings = {
  notesPath: string;
  fileSuffix: string;
};

const BASE_PATH = "/index.php/apps/notes/api/v1";

/** Client for the Nextcloud Notes API. */
export class UNBNotes {
  makeRequest: MakeRequest;

  constructor(makeRequest: MakeRequest) {
    this.makeRequest = makeRequest;
  }

  /**
   * Lists notes. Without `chunkSize`, returns every note; with it, returns one
   * page — pass the previous page's `cursor` back in to continue.
   */
  async getNotes(options?: {
    category?: string;
    exclude?: NoteField[];
    pruneBefore?: number;
    chunkSize?: number;
    chunkCursor?: string;
  }): Promise<NotesPage> {
    const params = new URLSearchParams();
    if (options?.category !== undefined) {
      params.set("category", options.category);
    }
    if (options?.exclude?.length) {
      params.set("exclude", options.exclude.join(","));
    }
    if (options?.pruneBefore !== undefined) {
      params.set("pruneBefore", String(options.pruneBefore));
    }
    if (options?.chunkSize !== undefined) {
      params.set("chunkSize", String(options.chunkSize));
    }
    if (options?.chunkCursor !== undefined) {
      params.set("chunkCursor", options.chunkCursor);
    }
    const query = params.size > 0 ? `?${params}` : "";
    const response = await this.makeRequest(
      "GET",
      `${BASE_PATH}/notes${query}`,
    );
    return {
      notes: await response.json(),
      cursor: response.headers.get("X-Notes-Chunk-Cursor") ?? undefined,
      pending: Number(response.headers.get("X-Notes-Chunk-Pending") ?? 0),
    };
  }

  /** Fetches a single note by id. */
  async getNote(id: number): Promise<Note> {
    const response = await this.makeRequest(
      "GET",
      `${BASE_PATH}/notes/${id}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch note ${id} (status ${response.status})`);
    }
    return await response.json();
  }

  /** Creates a new note. */
  async createNote(data: {
    title?: string;
    content?: string;
    category?: string;
    favorite?: boolean;
  }): Promise<Note> {
    const response = await this.makeRequest(
      "POST",
      `${BASE_PATH}/notes`,
      JSON.stringify(data),
    );
    if (!response.ok) {
      throw new Error(`Failed to create note (status ${response.status})`);
    }
    return await response.json();
  }

  /**
   * Updates a note. If `etag` is passed (from a previously fetched {@link Note}),
   * it's sent as `If-Match` so the update is rejected with a 412 instead of
   * silently overwriting a change made elsewhere since it was fetched.
   */
  async updateNote(
    id: number,
    data: {
      title?: string;
      content?: string;
      category?: string;
      favorite?: boolean;
    },
    etag?: string,
  ): Promise<Note> {
    const response = await this.makeRequest(
      "PUT",
      `${BASE_PATH}/notes/${id}`,
      JSON.stringify(data),
      etag ? { "If-Match": `"${etag}"` } : undefined,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to update note ${id} (status ${response.status})`,
      );
    }
    return await response.json();
  }

  /** Deletes a note. */
  async deleteNote(id: number): Promise<void> {
    await this.makeRequest("DELETE", `${BASE_PATH}/notes/${id}`);
  }

  /** Fetches the Notes app's per-user settings. */
  async getSettings(): Promise<NotesSettings> {
    const response = await this.makeRequest("GET", `${BASE_PATH}/settings`);
    return await response.json();
  }

  /** Updates the Notes app's per-user settings. Omitted fields are left unchanged. */
  async updateSettings(
    data: Partial<NotesSettings>,
  ): Promise<NotesSettings> {
    const response = await this.makeRequest(
      "PUT",
      `${BASE_PATH}/settings`,
      JSON.stringify(data),
    );
    return await response.json();
  }

  /** Downloads an attachment from a note, given the path returned by {@link uploadAttachment}. */
  async getAttachment(noteId: number, path: string): Promise<ArrayBuffer> {
    const response = await this.makeRequest(
      "GET",
      `${BASE_PATH}/attachment/${noteId}?path=${encodeURIComponent(path)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch attachment "${path}" on note ${noteId} (status ${response.status})`,
      );
    }
    return await response.arrayBuffer();
  }

  /** Uploads an attachment to a note and returns the path it was stored at. */
  async uploadAttachment(
    noteId: number,
    filename: string,
    content: Blob | Uint8Array | ArrayBuffer,
  ): Promise<string> {
    const form = new FormData();
    form.append(
      "file",
      content instanceof Blob ? content : new Blob([content]),
      filename,
    );
    const response = await this.makeRequest(
      "POST",
      `${BASE_PATH}/attachment/${noteId}`,
      form,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to upload attachment "${filename}" to note ${noteId} (status ${response.status})`,
      );
    }
    return (await response.json()).filename;
  }
}
