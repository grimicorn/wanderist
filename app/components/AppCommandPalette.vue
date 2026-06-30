<template>
  <div
    v-if="open"
    class="cmdk is-open"
    role="dialog"
    aria-label="Search"
    @keydown="onKeydown"
  >
    <div class="cmdk__scrim" @click="$emit('close')" />
    <div class="cmdk__panel">
      <div class="cmdk__search">
        <AppIcon name="search" :size="18" />
        <input
          ref="inputRef"
          v-model="query"
          class="cmdk__input"
          placeholder="Search places, trips, entries, people…"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="kbd">esc</span>
      </div>

      <div class="cmdk__results">
        <template v-if="visibleGroups.length">
          <div
            v-for="group in visibleGroups"
            :key="group.key"
            class="cmdk__group"
          >
            <div class="cmdk__glabel">{{ group.label }}</div>
            <component
              :is="item.action ? 'button' : 'NuxtLink'"
              v-for="(item, index) in group.items"
              :key="item.id"
              :type="item.action ? 'button' : undefined"
              :to="item.action ? undefined : (item.href ?? '/')"
              class="cmdk__item"
              :class="{
                'is-active': activeIndex === flatIndex(group.key, index),
              }"
              @click="item.action ? handleAction(item) : $emit('close')"
              @mouseenter="activeIndex = flatIndex(group.key, index)"
            >
              <span class="cmdk__ico">
                <AppIcon :name="item.icon" :size="15" />
              </span>
              <span class="cmdk__txt">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="cmdk__t" v-html="highlight(item.title)" />
                <span v-if="item.subtitle" class="cmdk__s">{{
                  item.subtitle
                }}</span>
              </span>
              <AppIcon name="arrow-right" :size="15" class="cmdk__go" />
            </component>
          </div>
        </template>
        <div v-else-if="searchError && query" class="cmdk__error" role="alert">
          {{ searchError }}
        </div>
        <div v-else-if="query && !searchIsLoading" class="cmdk__empty">
          No matches for &ldquo;{{ query }}&rdquo;. Try a place, trip or
          @handle.
        </div>
      </div>

      <div class="cmdk__foot">
        <span class="cmdk__keys"
          ><span class="kbd">↑</span><span class="kbd">↓</span> to
          navigate</span
        >
        <span class="cmdk__keys"><span class="kbd">↵</span> to open</span>
        <span class="cmdk__brand">wanderist</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, inject } from "vue";
import type { SearchItem } from "~/composables/useSearch";

// PaletteItem extends SearchItem so search results (which always have href) fit
// directly, while quick actions can supply either href or action (never both).
interface PaletteItem extends Omit<SearchItem, "href"> {
  href?: string;
  action?: () => void;
}

interface SearchGroup {
  key: string;
  label: string;
  items: PaletteItem[];
}

const openNewEntry = inject<(() => void) | undefined>(
  "openNewEntry",
  undefined,
);

const QUICK_ACTIONS: SearchGroup = {
  key: "actions",
  label: "Quick actions",
  items: [
    {
      id: "action-new-entry",
      title: "New entry",
      subtitle: "Write a journal entry",
      icon: "plus",
      action: () => openNewEntry?.(),
    },
    {
      id: "action-drop-pin",
      title: "Drop a pin",
      subtitle: "Add a place to your map",
      icon: "pin",
      href: "/map",
    },
    {
      id: "action-new-trip",
      title: "New trip",
      subtitle: "Start planning a route",
      icon: "route",
      href: "/trips",
    },
    {
      id: "action-open-map",
      title: "Open map",
      subtitle: "See your world",
      icon: "map",
      href: "/map",
    },
    {
      id: "action-settings",
      title: "Settings",
      subtitle: "Account & preferences",
      icon: "settings",
      href: "/settings",
    },
  ],
};

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const {
  query,
  results,
  isLoading: searchIsLoading,
  error: searchError,
  search,
} = useSearch();

function handleAction(item: PaletteItem): void {
  item.action?.();
  emit("close");
}

const visibleGroups = computed<SearchGroup[]>(() => {
  const trimmed = query.value.trim();

  if (!trimmed) {
    return [QUICK_ACTIONS];
  }

  const dynamicGroups: SearchGroup[] = [
    { key: "places", label: "Places", items: results.value.places },
    { key: "trips", label: "Trips", items: results.value.trips },
    { key: "entries", label: "Journal", items: results.value.entries },
    { key: "people", label: "People", items: results.value.people },
  ];

  return dynamicGroups.filter((group) => group.items.length > 0);
});

const flatItems = computed(() => visibleGroups.value.flatMap((g) => g.items));

function flatIndex(groupKey: string, indexInGroup: number): number {
  let offset = 0;
  for (const group of visibleGroups.value) {
    if (group.key === groupKey) {
      return offset + indexInGroup;
    }
    offset += group.items.length;
  }
  return 0;
}

function highlight(text: string): string {
  const q = query.value.trim();
  if (!q) {
    return text;
  }
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) {
    return text;
  }
  return `${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`;
}

function activateItem(item: PaletteItem): void {
  if (item.action) {
    handleAction(item);
    return;
  }
  if (item.href) {
    navigateTo(item.href);
  }
  emit("close");
}

function onKeydown(event: KeyboardEvent) {
  const total = flatItems.value.length;
  if (event.key === "Enter") {
    event.preventDefault();
    const activeItem = flatItems.value[activeIndex.value];
    if (activeItem) {
      activateItem(activeItem);
    }
  } else if (event.key === "Escape") {
    emit("close");
  } else if (total === 0) {
    return;
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % total;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + total) % total;
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      query.value = "";
      activeIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    }
  },
);

watch(query, (newQuery) => {
  activeIndex.value = 0;
  search(newQuery);
});
</script>
