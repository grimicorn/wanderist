/**
 * Global ⌘K (Mac) / Ctrl+K (Windows/Linux) shortcut for opening the command
 * palette. The key-matching logic is exported on its own so it can be unit
 * tested without mounting a component or touching the real DOM.
 */
export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}

/**
 * Registers the shortcut for as long as the calling component is mounted,
 * calling `onTrigger` when it fires. `onMounted` never runs during SSR, so
 * the `document` access inside it is safe without an extra client-only guard.
 */
export function useCommandPaletteShortcut(onTrigger: () => void): void {
  onMounted(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) {
        return;
      }
      event.preventDefault();
      onTrigger();
    };

    document.addEventListener("keydown", handleKeydown);
    onUnmounted(() => document.removeEventListener("keydown", handleKeydown));
  });
}
