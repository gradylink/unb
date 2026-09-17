/** A Nextcloud "rich object", used to reference things like files, users, and mentions inline in text. */
export type RichObjectParam = {
  type: string;
  id: string;
  name: string;
  path?: string;
  file?: string;
  "mention-id"?: string;
};
