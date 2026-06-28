import { requireUser } from "../utils/auth";

export default defineEventHandler((event) => {
  const userId = requireUser(event);
  return { userId };
});
