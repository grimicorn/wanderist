<template>
  <div v-if="isLoading" class="content content--wide">
    <div class="empty-note">Loading guide…</div>
  </div>

  <div v-else-if="!guide" class="content content--wide">
    <div class="empty-note">{{ guideError ?? "Guide not found." }}</div>
    <NuxtLink to="/guides" class="btn btn--outline btn--sm gdetail__back">
      back to guides
    </NuxtLink>
  </div>

  <article v-else class="content content--wide gdetail">
    <NuxtLink to="/guides" class="gdetail__back-link">
      <AppIcon name="arrow-left" :size="14" />
      guides
    </NuxtLink>

    <header class="gdetail__head">
      <h1>{{ guide.title }}</h1>
      <div class="gdetail__meta">
        <span class="m">
          <AppIcon name="clock" :size="12" />
          {{ guide.readTimeMinutes }} min read
        </span>
        <span class="m">
          <AppIcon name="heart" :size="12" />
          {{ guide.likeCount }}
        </span>
        <span class="tag" :class="visibilityTagClass">
          {{ guide.visibility }}
        </span>
      </div>
    </header>

    <div v-if="guide.body" class="gdetail__body">{{ guide.body }}</div>
    <div v-else class="empty-note">This guide has no content yet.</div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGuidesStore } from "~/stores/guides";
import type { GuideVisibility } from "~/stores/guides";

definePageMeta({ layout: "app", middleware: "auth" });

const VISIBILITY_TAG_CLASS: Record<GuideVisibility, string> = {
  public: "tag--ongoing",
  private: "tag--past",
};

const route = useRoute();
const guideId = computed(() => String(route.params.id));

const guidesStore = useGuidesStore();

const isLoading = computed(() => guidesStore.isLoadingGuide);
const guide = computed(() => guidesStore.currentGuide);
const guideError = computed(() => guidesStore.guideError);

useAsyncData(
  () => `guide-detail-${guideId.value}`,
  () => guidesStore.fetchGuideById(guideId.value).catch(() => undefined),
  { watch: [guideId] },
);

const visibilityTagClass = computed(() =>
  guide.value ? VISIBILITY_TAG_CLASS[guide.value.visibility] : "",
);

useHead(
  computed(() => ({
    title: guide.value
      ? `Wanderist — ${guide.value.title}`
      : "Wanderist — Guide",
  })),
);
</script>

<style scoped>
.gdetail {
  /* Breathing room after a long read so the body never butts against the
     viewport edge on short guides. */
  padding-bottom: 40px;
}
.gdetail__back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  margin-bottom: 18px;
}
.gdetail__back-link:hover {
  color: var(--accent-ink);
}
.gdetail__head h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.gdetail__meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11.5px;
  color: var(--faint);
  margin-top: 10px;
}
.gdetail__meta .m {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.gdetail__body {
  margin-top: 24px;
  font-size: 14.5px;
  line-height: 1.7;
  /* Guide bodies are stored as plain text; preserve the author's line breaks
     and paragraph spacing without an HTML/markdown renderer. */
  white-space: pre-wrap;
}
.gdetail__back {
  margin-top: 16px;
}
/* Local copy of GuidesList.vue's .empty-note — that rule is `scoped` to its own
   component, so the loading / not-found / empty-body states here need their own
   styling for the text to read as muted rather than raw body copy. */
.empty-note {
  font-size: 12.5px;
  color: var(--faint);
  padding: 12px 0;
}
</style>
