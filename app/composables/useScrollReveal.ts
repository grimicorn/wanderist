export function useScrollReveal(root?: Ref<HTMLElement | null>) {
  if (!import.meta.client) {
    return;
  }

  onMounted(() => {
    const scope = root?.value ?? document.documentElement;

    const targets = scope.querySelectorAll<HTMLElement>(
      "[data-reveal], [data-reveal-stagger]",
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const el = entry.target as HTMLElement;
          const stagger = el.hasAttribute("data-reveal-stagger");
          const step = parseInt(
            el.getAttribute("data-reveal-step") ?? "60",
            10,
          );

          el.classList.add("is-revealed");

          if (stagger) {
            const children = Array.from(el.children) as HTMLElement[];
            children.forEach((child, i) => {
              child.style.transitionDelay = `${i * step}ms`;
            });
          }

          observer.unobserve(el);
        });
      },
      { threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));

    onUnmounted(() => observer.disconnect());
  });
}
