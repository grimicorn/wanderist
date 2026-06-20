import * as vue from 'vue'

// Expose Vue composition API as globals to match Nuxt's auto-import behavior
Object.assign(globalThis, vue)
