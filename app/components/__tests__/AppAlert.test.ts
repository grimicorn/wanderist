import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import AppAlert from '../AppAlert.vue'
import AppIcon from '../AppIcon.vue'

const globalStubs = {
  global: {
    components: { AppIcon },
    stubs: { AppIcon: { template: '<svg data-icon />' } },
  },
}

describe('AppAlert', () => {
  it('renders an info alert by default', () => {
    const wrapper = mount(AppAlert, {
      props: { message: 'Something happened' },
      ...globalStubs,
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.classes()).toContain('alert--info')
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders each intent variant', () => {
    const intents = ['error', 'warning', 'success', 'info'] as const
    for (const intent of intents) {
      const wrapper = mount(AppAlert, {
        props: { intent, message: `${intent} message` },
        ...globalStubs,
      })
      expect(wrapper.classes()).toContain(`alert--${intent}`)
      expect(wrapper.html()).toMatchSnapshot()
    }
  })

  it('shows a title when provided', () => {
    const wrapper = mount(AppAlert, {
      props: { intent: 'error', title: 'Oops', message: 'Something went wrong' },
      ...globalStubs,
    })
    expect(wrapper.find('.alert__title').text()).toBe('Oops')
  })

  it('renders slot content as the message', () => {
    const wrapper = mount(AppAlert, {
      props: { intent: 'info' },
      slots: { default: 'Slot message here' },
      ...globalStubs,
    })
    expect(wrapper.find('.alert__msg').text()).toBe('Slot message here')
  })

  it('does not show dismiss button when dismissible is false', () => {
    const wrapper = mount(AppAlert, {
      props: { message: 'hi', dismissible: false },
      ...globalStubs,
    })
    expect(wrapper.find('.alert__close').exists()).toBe(false)
  })

  it('shows dismiss button when dismissible is true', () => {
    const wrapper = mount(AppAlert, {
      props: { message: 'hi', dismissible: true },
      ...globalStubs,
    })
    expect(wrapper.find('.alert__close').exists()).toBe(true)
  })

  it('hides the alert when dismiss button is clicked', async () => {
    const wrapper = mount(AppAlert, {
      props: { message: 'hi', dismissible: true },
      ...globalStubs,
    })
    await wrapper.find('.alert__close').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
