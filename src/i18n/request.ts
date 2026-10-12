import { getRequestConfig } from "next-intl/server";
import messages from "../messages/en.json";

// English is the only supported language.
export default getRequestConfig(async () => ({
  locale: "en",
  timeZone: "Asia/Riyadh",
  messages,
}));
