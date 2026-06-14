import { defineStore } from "pinia";

export const useUserStore = defineStore("user", () => {
  const { user, isLoaded, isSignedIn } = useClerkUser();

  return { user, isLoaded, isSignedIn };
});
