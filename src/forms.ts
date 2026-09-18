/**
 * API for Nextcloud Forms: building and managing forms, and reading or
 * submitting responses.
 *
 * @module forms
 */

import { ShareType } from "./files.ts";
import type { MakeRequest } from "./types.ts";

/** The lifecycle state of a {@link Form}. */
export enum FormState {
  Active = 0,
  Closed = 1,
  Archived = 2,
}

/** What a user is allowed to do with a form. */
export type FormPermission =
  | "edit"
  | "results"
  | "results_delete"
  | "submit"
  /** Only meaningful on a public link share. */
  | "embed";

/** Extended sharing options for a form. */
export type FormAccess = {
  permitAllUsers?: boolean;
  showToAllUsers?: boolean;
};

/** The kind of a {@link Question}. */
export type QuestionType =
  | "dropdown"
  | "multiple"
  | "multiple_unique"
  | "short"
  | "long"
  | "date"
  /** @deprecated No longer available for new questions. */
  | "datetime"
  | "time"
  | "file"
  | "linearscale"
  | "color"
  | "ranking"
  | "grid";

/** The cell type used by a `grid`-type question. */
export type QuestionGridCellType = "checkbox" | "number" | "radio";

/** Extra, question-type-specific settings. See the Forms data structure docs for which apply to which {@link QuestionType}. */
export type QuestionExtraSettings = {
  allowOtherAnswer?: boolean;
  shuffleOptions?: boolean;
  optionsLimitMax?: number;
  optionsLimitMin?: number;
  validationType?: "phone" | "email" | "regex" | "number" | null;
  validationRegex?: string;
  allowedFileTypes?: string[];
  allowedFileExtensions?: string[];
  maxAllowedFilesCount?: number;
  maxFileSize?: number;
  dateMax?: string | number;
  dateMin?: string | number;
  dateRange?: boolean;
  timeMax?: string;
  timeMin?: string;
  timeRange?: boolean;
  optionsLowest?: 0 | 1;
  optionsHighest?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  optionsLabelLowest?: string;
  optionsLabelHighest?: string;
  columns?: string[];
  rows?: string[];
  questionType?: QuestionGridCellType;
};

/** The visual/semantic role of an {@link Option}. */
export type OptionType = "choice" | "row" | "column";

/** A predefined answer choice belonging to a {@link Question}. */
export type Option = {
  id: number;
  questionId: number;
  order: number | null;
  text: string;
  optionType?: OptionType;
};

/** A single question on a form. */
export type Question = {
  id: number;
  formId: number;
  order: number;
  type: QuestionType;
  isRequired: boolean;
  text: string;
  name: string;
  description?: string;
  options: Option[];
  extraSettings: QuestionExtraSettings;
  /** Allowed mime-types/extensions, for `file`-type questions. */
  accept?: string[];
};

/** A share of a form with a user, group, or as a public link. */
export type FormShare = {
  id: number;
  formId: number;
  shareType: ShareType;
  shareWith: string;
  displayName: string;
  permissions?: FormPermission[];
};

/** A condensed form, as returned by {@link UNBForms.getForms}. */
export type FormListItem = {
  id: number;
  hash: string;
  title: string;
  expires: number;
  permissions: FormPermission[];
  partial: true;
  state: FormState;
  lockedBy: string | null;
  lockedUntil: number | null;
  maxSubmissions: number | null;
};

/** The full data of a form, as returned by {@link UNBForms.getForm}. */
export type Form = {
  id: number;
  hash: string;
  title: string;
  description: string;
  ownerId: string;
  created: number;
  lastUpdated: number;
  access: FormAccess;
  expires: number;
  fileFormat: string | null;
  fileId: number | null;
  filePath?: string | null;
  isAnonymous: boolean;
  isMaxSubmissionsReached: boolean;
  maxSubmissions: number | null;
  submitMultiple: boolean;
  allowEditSubmissions: boolean;
  allowComments: boolean;
  showExpiration: boolean;
  canSubmit: boolean;
  state: FormState;
  lockedBy: string | null;
  lockedUntil: number | null;
  permissions: FormPermission[];
  questions: Question[];
  shares: FormShare[];
  submissionCount?: number;
  submissionMessage: string | null;
  confirmationEmailEnabled: boolean;
  confirmationEmailSubject: string | null;
  confirmationEmailBody: string | null;
  confirmationEmailQuestionId: number | null;
};

/** A single answer within a {@link Submission}. */
export type Answer = {
  id: number;
  submissionId: number;
  fileId?: number | null;
  questionId: number;
  questionName?: string;
  text: string;
};

/** One user's response to a form. */
export type Submission = {
  id: number;
  formId: number;
  userId: string;
  timestamp: number;
  answers: Answer[];
  userDisplayName: string;
};

/** A page of submissions, as returned by {@link UNBForms.getSubmissions}. */
export type SubmissionsPage = {
  submissions: Submission[];
  questions: Question[];
  filteredSubmissionsCount: number;
};

/** A file staged (via {@link UNBForms.uploadSubmissionFile}) to answer a `file`-type question. */
export type UploadedFile = {
  uploadedFileId: number;
  fileName: string;
  uploadToken: string;
};

/** A staged file answer, as returned by {@link UNBForms.uploadSubmissionFile}. */
export type SubmissionFileAnswer = {
  uploadedFileId: number;
  uploadToken: string;
};

/**
 * Answers to submit, keyed by question id. For `multiple`/`multiple_unique`/
 * `dropdown` questions the values are option ids; for text-based questions
 * they're strings; for `file` questions they're the {@link SubmissionFileAnswer}s
 * returned by {@link UNBForms.uploadSubmissionFile}.
 */
export type SubmissionAnswers = Record<
  number,
  Array<string | number | SubmissionFileAnswer>
>;

export type SubmissionsFileFormat = "csv" | "ods" | "xlsx";

const BASE_PATH = "/ocs/v2.php/apps/forms/api/v3";

/** Client for the Nextcloud Forms API. */
export class UNBForms {
  makeRequest: MakeRequest;

  constructor(makeRequest: MakeRequest) {
    this.makeRequest = makeRequest;
  }

  private withFormat(path: string): string {
    return `${path}${path.includes("?") ? "&" : "?"}format=json`;
  }

  private async ocs<T>(
    method: string,
    path: string,
    body?: BodyInit,
  ): Promise<T> {
    const response = await this.makeRequest(
      method,
      this.withFormat(path),
      body,
    );
    if (!response.ok) {
      throw new Error(
        `Forms request "${method} ${path}" failed (status ${response.status})`,
      );
    }
    return (await response.json()).ocs.data;
  }

  /** Lists forms owned by, or shared with, the bot user. */
  getForms(type: "owned" | "shared" = "owned"): Promise<FormListItem[]> {
    return this.ocs("GET", `${BASE_PATH}/forms?type=${type}`);
  }

  /** Fetches the full data of a form: its properties, questions, options, and shares. */
  getForm(formId: number): Promise<Form> {
    return this.ocs("GET", `${BASE_PATH}/forms/${formId}`);
  }

  /** Creates a new, empty form. */
  createForm(): Promise<Form> {
    return this.ocs("POST", `${BASE_PATH}/forms`);
  }

  /** Creates a copy of a form, without its submissions. */
  cloneForm(formId: number): Promise<Form> {
    return this.ocs("POST", `${BASE_PATH}/forms?fromId=${formId}`);
  }

  /**
   * Updates properties of a form. Cannot change `id`, `hash`, `ownerId`, or
   * `created`. To transfer ownership, pass only `{ ownerId: newOwnerUserId }`.
   */
  updateForm(
    formId: number,
    keyValuePairs: Record<string, unknown>,
  ): Promise<number> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}`,
      JSON.stringify({ keyValuePairs }),
    );
  }

  /** Deletes a form and all its questions, options, shares, and submissions. */
  deleteForm(formId: number): Promise<number> {
    return this.ocs("DELETE", `${BASE_PATH}/forms/${formId}`);
  }

  /** Lists the questions (with options) of a form. */
  getQuestions(formId: number): Promise<Question[]> {
    return this.ocs("GET", `${BASE_PATH}/forms/${formId}/questions`);
  }

  /** Fetches a single question (with options) of a form. */
  getQuestion(formId: number, questionId: number): Promise<Question> {
    return this.ocs(
      "GET",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}`,
    );
  }

  /** Creates a new question on a form. */
  createQuestion(
    formId: number,
    data: {
      type: QuestionType;
      subtype?: QuestionGridCellType;
      text?: string;
      position?: number;
    },
  ): Promise<Question> {
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/questions`,
      JSON.stringify(data),
    );
  }

  /** Creates a copy of a question, with all its options. */
  cloneQuestion(
    formId: number,
    questionId: number,
    position?: number,
  ): Promise<Question> {
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/questions?fromId=${questionId}`,
      position !== undefined ? JSON.stringify({ position }) : undefined,
    );
  }

  /** Updates properties of a question. Cannot change `id`, `formId`, or `order`. */
  updateQuestion(
    formId: number,
    questionId: number,
    keyValuePairs: Record<string, unknown>,
  ): Promise<number> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}`,
      JSON.stringify({ keyValuePairs }),
    );
  }

  /** Reorders all questions of a form. `questionIds` must list every question id on the form. */
  reorderQuestions(
    formId: number,
    questionIds: number[],
  ): Promise<Record<string, { order: number }>> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}/questions`,
      JSON.stringify({ newOrder: questionIds }),
    );
  }

  /** Deletes a question and its options. */
  deleteQuestion(formId: number, questionId: number): Promise<number> {
    return this.ocs(
      "DELETE",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}`,
    );
  }

  /** Adds one or more options to a question. */
  createOptions(
    formId: number,
    questionId: number,
    optionTexts: string[],
    optionType?: OptionType,
  ): Promise<Option[]> {
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}/options`,
      JSON.stringify({ optionTexts, optionType }),
    );
  }

  /** Updates properties of an option. Cannot change `id` or `questionId`. */
  updateOption(
    formId: number,
    questionId: number,
    optionId: number,
    keyValuePairs: Record<string, unknown>,
  ): Promise<number> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}/options/${optionId}`,
      JSON.stringify({ keyValuePairs }),
    );
  }

  /** Deletes an option. */
  deleteOption(
    formId: number,
    questionId: number,
    optionId: number,
  ): Promise<number> {
    return this.ocs(
      "DELETE",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}/options/${optionId}`,
    );
  }

  /** Reorders all options of a question. `optionIds` must list every option id on the question. */
  reorderOptions(
    formId: number,
    questionId: number,
    optionIds: number[],
    optionType?: OptionType,
  ): Promise<Record<string, { order: number }>> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}/questions/${questionId}/options`,
      JSON.stringify({ newOrder: optionIds, optionType }),
    );
  }

  /** Shares a form with a user or group, or creates a public link share. */
  createShare(
    formId: number,
    data: {
      shareType: ShareType;
      shareWith?: string;
      permissions?: FormPermission[];
    },
  ): Promise<FormShare> {
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/shares`,
      JSON.stringify(data),
    );
  }

  /**
   * Updates a share. Only `permissions` and (for link shares, if the admin
   * setting `allowCustomPublicShareTokens` is enabled) `token` may be changed.
   */
  updateShare(
    formId: number,
    shareId: number,
    keyValuePairs: Record<string, unknown>,
  ): Promise<number> {
    return this.ocs(
      "PATCH",
      `${BASE_PATH}/forms/${formId}/shares/${shareId}`,
      JSON.stringify({ keyValuePairs }),
    );
  }

  /** Deletes a share. */
  deleteShare(formId: number, shareId: number): Promise<number> {
    return this.ocs("DELETE", `${BASE_PATH}/forms/${formId}/shares/${shareId}`);
  }

  /** Generates a random token usable as a custom public share link token. */
  async generateShareToken(): Promise<string> {
    return (await this.ocs<{ token: string }>("GET", `${BASE_PATH}/token`))
      .token;
  }

  /** Lists submissions to a form, newest first. */
  getSubmissions(
    formId: number,
    options?: { query?: string; limit?: number; offset?: number },
  ): Promise<SubmissionsPage> {
    const params = new URLSearchParams();
    if (options?.query !== undefined) params.set("query", options.query);
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.set("offset", String(options.offset));
    }
    const query = params.size > 0 ? `?${params}` : "";
    return this.ocs("GET", `${BASE_PATH}/forms/${formId}/submissions${query}`);
  }

  /**
   * Fetches a single submission. Viewing another user's submission requires
   * the `results` permission; otherwise only the submission's owner may view it.
   */
  getSubmission(formId: number, submissionId: number): Promise<Submission> {
    return this.ocs(
      "GET",
      `${BASE_PATH}/forms/${formId}/submissions/${submissionId}`,
    );
  }

  /** Downloads all submissions to a form as a spreadsheet file. */
  async exportSubmissions(
    formId: number,
    fileFormat: SubmissionsFileFormat = "csv",
  ): Promise<Blob> {
    const response = await this.makeRequest(
      "GET",
      `${BASE_PATH}/forms/${formId}/submissions?fileFormat=${fileFormat}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to export submissions for form ${formId} (status ${response.status})`,
      );
    }
    return await response.blob();
  }

  /** Exports all submissions to a form as a spreadsheet file, saved into the bot user's files. Returns the created file's name. */
  exportSubmissionsToFiles(
    formId: number,
    path: string,
    fileFormat?: SubmissionsFileFormat,
  ): Promise<string> {
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/submissions/export`,
      JSON.stringify({ path, fileFormat }),
    );
  }

  /** Deletes all submissions to a form. */
  deleteSubmissions(formId: number): Promise<number> {
    return this.ocs("DELETE", `${BASE_PATH}/forms/${formId}/submissions`);
  }

  /**
   * Uploads a file to answer a `file`-type question before submitting the
   * form. Pass the returned {@link UploadedFile}'s `uploadedFileId` and
   * `uploadToken` back as the answer for this question in {@link submit}.
   */
  uploadSubmissionFile(
    formId: number,
    questionId: number,
    filename: string,
    content: Blob | Uint8Array | ArrayBuffer,
    shareHash?: string,
  ): Promise<UploadedFile[]> {
    const form = new FormData();
    form.append(
      "files[]",
      content instanceof Blob ? content : new Blob([content]),
      filename,
    );
    if (shareHash !== undefined) form.append("shareHash", shareHash);
    return this.ocs(
      "POST",
      `${BASE_PATH}/forms/${formId}/submissions/files/${questionId}`,
      form,
    );
  }

  /** Submits answers to a form. */
  async submit(
    formId: number,
    answers: SubmissionAnswers,
    shareHash?: string,
  ): Promise<void> {
    const response = await this.makeRequest(
      "POST",
      this.withFormat(`${BASE_PATH}/forms/${formId}/submissions`),
      JSON.stringify({ answers, shareHash }),
    );
    if (!response.ok) {
      throw new Error(
        `Failed to submit form ${formId} (status ${response.status})`,
      );
    }
  }

  /**
   * Updates an existing submission. Only the submission's owner may do this,
   * and only if the form has `allowEditSubmissions` enabled.
   */
  updateSubmission(
    formId: number,
    submissionId: number,
    answers: SubmissionAnswers,
  ): Promise<number> {
    return this.ocs(
      "PUT",
      `${BASE_PATH}/forms/${formId}/submissions/${submissionId}`,
      JSON.stringify({ answers }),
    );
  }

  /** Deletes a single submission. */
  deleteSubmission(formId: number, submissionId: number): Promise<number> {
    return this.ocs(
      "DELETE",
      `${BASE_PATH}/forms/${formId}/submissions/${submissionId}`,
    );
  }
}
