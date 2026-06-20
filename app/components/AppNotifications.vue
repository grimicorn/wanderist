<template>
  <div v-if="open" class="notif is-open" role="dialog" aria-label="Notifications">
    <div class="notif__head">
      <b>Notifications</b>
      <button class="notif__mark" @click="markAllRead">mark all read</button>
    </div>
    <div class="notif__list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notif__item"
        :class="{ 'is-unread': notification.unread }"
      >
        <span class="notif__ico" :class="`notif__ico--${notification.tone}`">
          <AppIcon :name="notification.icon" :size="16" />
        </span>
        <div class="notif__body">
          <p class="notif__title" v-html="notification.title" />
          <span class="notif__time">{{ notification.time }}</span>
        </div>
        <span class="notif__dot" />
      </div>
    </div>
    <NuxtLink class="notif__foot" to="/activity">
      View all activity
      <AppIcon name="arrow-right" :size="14" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type NotifTone = 'accent' | 'info' | 'success' | 'warning'

interface Notification {
  id: number
  icon: string
  tone: NotifTone
  unread: boolean
  title: string
  time: string
}

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const notifications = ref<Notification[]>([
  { id: 1, icon: 'instagram', tone: 'info', unread: true, title: '12 geotagged photos from Lisbon are ready to import', time: '2h' },
  { id: 2, icon: 'heart', tone: 'accent', unread: true, title: '<b>elsa_far</b> liked your entry "Harbor at 4am"', time: '5h' },
  { id: 3, icon: 'message', tone: 'accent', unread: true, title: '<b>marco.travels</b> commented on "Tram 28, again"', time: 'Yesterday' },
  { id: 4, icon: 'check-circle', tone: 'success', unread: false, title: 'Your trip "Iceland, the ring road" is now public', time: '2d' },
  { id: 5, icon: 'users', tone: 'accent', unread: false, title: '<b>yuki</b> started following you', time: '4d' },
  { id: 6, icon: 'alert-triangle', tone: 'warning', unread: false, title: 'Your trial ends in 3 days — add a payment method', time: '5d' },
])

function markAllRead() {
  notifications.value = notifications.value.map((n) => ({ ...n, unread: false }))
}
</script>
