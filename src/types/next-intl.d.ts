import type messages from "../../messages/en.json";

type Messages = typeof messages;

declare global {
  // oxlint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
