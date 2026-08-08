<template>
  <!-- Only shown before any guides have loaded — a refetch (e.g. retry)
       while guides are already on screen must not blank the list out from
       under the user, so this checks the list is still empty too. -->
  <div v-if="isLoading && !guides.length" class="empty-note">
    Loading guides…
  </div>
  <div v-else-if="guides.length" class="guide-list">
    <template v-for="guide in guides" :key="guide.id">
      <GuideForm
        v-if="editingGuideId === guide.id"
        title="Edit guide"
        submit-label="save changes"
        :initial-guide="guide"
        :pending="isSavingGuide"
        :error="formError"
        @submit="(input) => emit('submitEdit', guide.id, input)"
        @cancel="emit('cancelEdit')"
      />
      <GuideCard
        v-else
        :guide="guide"
        :deleting="deletingGuideIds.has(guide.id)"
        :is-liked="likedGuideIds.has(guide.id)"
        @edit="emit('edit', guide)"
        @delete="emit('delete', guide)"
        @toggle-like="emit('toggle-like', guide)"
      />
    </template>
  </div>
  <!-- Gated on hasLoaded (not just !isLoading) so this never flashes before
       the initial fetch resolves — see hasLoaded in stores/guides.ts. -->
  <div v-else-if="hasLoaded" class="empty-note">
    No guides yet — write your first one above.
  </div>
</template>

<script setup lang="ts">
import type { CreateGuideInput, Guide } from "~/stores/guides";
import GuideForm from "~/components/GuideForm.vue";
import GuideCard from "~/components/GuideCard.vue";

defineProps<{
  guides: Guide[];
  isLoading: boolean;
  hasLoaded: boolean;
  editingGuideId: string | null;
  deletingGuideIds: Set<string>;
  likedGuideIds: Set<string>;
  isSavingGuide: boolean;
  formError: string | null;
}>();

const emit = defineEmits<{
  edit: [guide: Guide];
  delete: [guide: Guide];
  "toggle-like": [guide: Guide];
  submitEdit: [guideId: string, input: CreateGuideInput];
  cancelEdit: [];
}>();
</script>

<style scoped>
.guide-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-note {
  font-size: 12.5px;
  color: var(--faint);
  padding: 12px 0;
}
</style>
