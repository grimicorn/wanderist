<template>
  <div v-if="open" class="cmdk is-open" role="dialog" aria-label="Search" @keydown="onKeydown">
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
          <div v-for="group in visibleGroups" :key="group.key" class="cmdk__group">
            <div class="cmdk__glabel">{{ group.label }}</div>
            <NuxtLink
              v-for="(item, index) in group.items"
              :key="item.title"
              :to="item.href"
              class="cmdk__item"
              :class="{ 'is-active': activeIndex === flatIndex(group.key, index) }"
              @click="$emit('close')"
              @mouseenter="activeIndex = flatIndex(group.key, index)"
            >
              <span class="cmdk__ico">
                <AppIcon :name="item.icon" :size="15" />
              </span>
              <span class="cmdk__txt">
                <span class="cmdk__t" v-html="highlight(item.title)" />
                <span v-if="item.subtitle" class="cmdk__s">{{ item.subtitle }}</span>
              </span>
              <AppIcon name="arrow-right" :size="15" class="cmdk__go" />
            </NuxtLink>
          </div>
        </template>
        <div v-else-if="query" class="cmdk__empty">
          No matches for &ldquo;{{ query }}&rdquo;. Try a place, trip or @handle.
        </div>
      </div>

      <div class="cmdk__foot">
        <span class="cmdk__keys"><span class="kbd">↑</span><span class="kbd">↓</span> to navigate</span>
        <span class="cmdk__keys"><span class="kbd">↵</span> to open</span>
        <span class="cmdk__brand">wanderist</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface SearchItem {
  title: string
  subtitle?: string
  icon: string
  href: string
}

interface SearchGroup {
  key: string
  label: string
  items: SearchItem[]
}

const ALL_GROUPS: SearchGroup[] = [
  {
    key: 'actions',
    label: 'Quick actions',
    items: [
      { title: 'New entry', subtitle: 'Write a journal entry', icon: 'plus', href: '/journal/new' },
      { title: 'Drop a pin', subtitle: 'Add a place to your map', icon: 'pin', href: '/map' },
      { title: 'New trip', subtitle: 'Start planning a route', icon: 'route', href: '/trips' },
      { title: 'Open map', subtitle: 'See your world', icon: 'map', href: '/map' },
      { title: 'Settings', subtitle: 'Account & preferences', icon: 'settings', href: '/settings' },
    ],
  },
  {
    key: 'places',
    label: 'Places',
    items: [
      { title: 'Reykjavík', subtitle: 'Iceland · 4 entries', icon: 'pin', href: '/map' },
      { title: 'Lisbon', subtitle: 'Portugal · 12 photos', icon: 'pin', href: '/map' },
      { title: 'London', subtitle: 'United Kingdom', icon: 'pin', href: '/map' },
      { title: 'Tokyo', subtitle: 'Japan · 2025', icon: 'pin', href: '/map' },
      { title: 'Marrakech', subtitle: 'Morocco · 2025', icon: 'pin', href: '/map' },
      { title: 'Sydney', subtitle: 'Australia · 2024', icon: 'pin', href: '/map' },
    ],
  },
  {
    key: 'trips',
    label: 'Trips',
    items: [
      { title: 'Iceland, the ring road', subtitle: 'Ongoing · day 6 of 9', icon: 'route', href: '/trips/1' },
      { title: 'Portugal 2026', subtitle: '6 entries · Jun 2026', icon: 'route', href: '/trips/2' },
      { title: 'Japan 2025', subtitle: '9 entries · past', icon: 'route', href: '/trips/3' },
    ],
  },
  {
    key: 'entries',
    label: 'Journal',
    items: [
      { title: 'Harbor at 4am', subtitle: 'Reykjavík · Jun 12', icon: 'journal', href: '/journal' },
      { title: 'Tram 28, again', subtitle: 'Lisbon · Jun 8', icon: 'journal', href: '/journal' },
      { title: 'Glacier lagoon morning', subtitle: 'Jökulsárlón · Jun 11', icon: 'journal', href: '/journal' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { title: '@elsa_far', subtitle: 'Reykjavík · follows you', icon: 'user', href: '/explore' },
      { title: '@marco.travels', subtitle: 'Lisbon · 2.1k places', icon: 'user', href: '/explore' },
      { title: '@yuki', subtitle: 'Tokyo', icon: 'user', href: '/explore' },
    ],
  },
]

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const visibleGroups = computed<SearchGroup[]>(() => {
  const q = query.value.trim().toLowerCase()
  return ALL_GROUPS.flatMap((group) => {
    const filtered = q
      ? group.items.filter((item) => `${item.title} ${item.subtitle ?? ''}`.toLowerCase().includes(q))
      : group.key === 'actions'
      ? group.items
      : []
    if (!filtered.length) {
      return []
    }
    return [{ ...group, items: filtered }]
  })
})

const flatItems = computed(() => visibleGroups.value.flatMap((g) => g.items))

function flatIndex(groupKey: string, indexInGroup: number): number {
  let offset = 0
  for (const group of visibleGroups.value) {
    if (group.key === groupKey) {
      return offset + indexInGroup
    }
    offset += group.items.length
  }
  return 0
}

function highlight(text: string): string {
  const q = query.value.trim()
  if (!q) {
    return text
  }
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) {
    return text
  }
  return `${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`
}

function onKeydown(event: KeyboardEvent) {
  const total = flatItems.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + total) % total
  } else if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      query.value = ''
      activeIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

watch(query, () => {
  activeIndex.value = 0
})
</script>
