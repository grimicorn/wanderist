import { applyTheme, readStoredTheme } from "~/utils/theme";

export type { Theme } from "~/utils/theme";

export function useTheme() {
  const theme = useState<import("~/utils/theme").Theme>("theme", () => "light");

  function setTheme(t: import("~/utils/theme").Theme) {
    theme.value = t;
    if (import.meta.client) {
      applyTheme(t);
    }
  }

  function toggleTheme() {
    setTheme(theme.value === "light" ? "dark" : "light");
  }

  if (import.meta.client) {
    onMounted(() => {
      const stored = readStoredTheme();
      theme.value = stored;
      applyTheme(stored);
    });
  }

  return { theme: readonly(theme), setTheme, toggleTheme };
}
