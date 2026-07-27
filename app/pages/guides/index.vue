<template>
  <div class="content content--wide">
    <div class="guides-head">
      <div>
        <div class="label">// {{ guidesStore.guides.length }} guides</div>
        <h1>Your guides</h1>
        <p>Write up a route, a city, or a trick you always tell people.</p>
      </div>
      <button class="btn btn--outline" @click="openNewGuideForm">
        <AppIcon name="layers" :size="15" />
        new guide
      </button>
    </div>

    <!-- New guide form -->
    <GuideForm
      v-if="showNewGuideForm"
      title="New guide"
      submit-label="publish guide"
      :pending="isSavingGuide"
      :error="formError"
      @submit="handleCreateGuide"
      @cancel="closeNewGuideForm"
    />

    <!-- List load error -->
    <div v-if="guidesStore.error" class="alert alert--error" role="alert">
      {{ guidesStore.error }}
    </div>

    <!-- Delete error (create/edit errors render inside GuideForm itself) -->
    <div v-if="deleteError" class="alert alert--error" role="alert">
      {{ deleteError }}
    </div>

    <div v-if="guidesStore.isLoading" class="empty-note">Loading guides…</div>

    <!-- Guides list -->
    <div v-else-if="guidesStore.guides.length" class="guide-list">
      <template v-for="guide in guidesStore.guides" :key="guide.id">
        <GuideForm
          v-if="editingGuideId === guide.id"
          title="Edit guide"
          submit-label="save changes"
          :initial-guide="guide"
          :pending="isSavingGuide"
          :error="formError"
          @submit="(input) => handleUpdateGuide(guide.id, input)"
          @cancel="cancelEditGuide"
        />
        <GuideCard
          v-else
          :guide="guide"
          :deleting="deletingGuideId === guide.id"
          @edit="startEditGuide"
          @delete="handleDeleteGuide"
        />
      </template>
    </div>
    <!-- Gated on hasLoaded (not just !isLoading) so this never flashes before
         the initial fetch resolves — see hasLoaded in stores/guides.ts. -->
    <div v-else-if="guidesStore.hasLoaded" class="empty-note">
      No guides yet — write your first one above.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useGuidesStore } from "~/stores/guides";
import type {
  Guide,
  CreateGuideInput,
  UpdateGuideInput,
} from "~/stores/guides";
import GuideForm from "~/components/GuideForm.vue";
import GuideCard from "~/components/GuideCard.vue";

definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "Wanderist — Guides" });

const guidesStore = useGuidesStore();

const showNewGuideForm = ref(false);
const editingGuideId = ref<string | null>(null);
const isSavingGuide = ref(false);
const deletingGuideId = ref<string | null>(null);
const formError = ref<string | null>(null);
const deleteError = ref<string | null>(null);

function openNewGuideForm(): void {
  editingGuideId.value = null;
  formError.value = null;
  deleteError.value = null;
  showNewGuideForm.value = true;
}

function closeNewGuideForm(): void {
  showNewGuideForm.value = false;
  formError.value = null;
}

function startEditGuide(guide: Guide): void {
  showNewGuideForm.value = false;
  formError.value = null;
  deleteError.value = null;
  editingGuideId.value = guide.id;
}

function cancelEditGuide(): void {
  editingGuideId.value = null;
  formError.value = null;
}

async function handleCreateGuide(input: CreateGuideInput): Promise<void> {
  isSavingGuide.value = true;
  formError.value = null;

  try {
    await guidesStore.createGuide(input);
    closeNewGuideForm();
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "Failed to create guide";
  } finally {
    isSavingGuide.value = false;
  }
}

async function handleUpdateGuide(
  guideId: string,
  input: UpdateGuideInput,
): Promise<void> {
  isSavingGuide.value = true;
  formError.value = null;

  try {
    await guidesStore.updateGuide(guideId, input);
    cancelEditGuide();
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "Failed to update guide";
  } finally {
    isSavingGuide.value = false;
  }
}

async function handleDeleteGuide(guide: Guide): Promise<void> {
  if (deletingGuideId.value) {
    // A delete is already in flight — GuideCard disables its confirm/cancel
    // buttons while `deleting` is true, so this only guards against an event
    // that slips through before Vue re-renders the disabled state.
    return;
  }

  deletingGuideId.value = guide.id;
  deleteError.value = null;

  try {
    await guidesStore.deleteGuide(guide.id);
  } catch (error) {
    deleteError.value =
      error instanceof Error ? error.message : "Failed to delete guide";
  } finally {
    deletingGuideId.value = null;
  }
}

onMounted(() => {
  guidesStore.fetchGuides().catch((error) => {
    console.error("[guides] failed to load guides on mount", error);
  });
});
</script>

<style scoped>
.guides-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.guides-head h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 10px;
}
.guides-head p {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}

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
