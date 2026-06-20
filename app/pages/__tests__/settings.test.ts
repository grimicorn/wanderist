import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsPage from '../settings.vue'

const iconStub = { template: '<svg data-icon />' }
const inputStub = { template: '<input />', props: ['modelValue', 'label', 'type', 'placeholder', 'state', 'hint', 'icon', 'required'] }
const textareaStub = { template: '<textarea />', props: ['modelValue', 'label', 'placeholder', 'rows'] }
const alertStub = { template: '<div class="alert" />', props: ['intent', 'title'] }
const topbarStub = { template: '<header class="topbar"><slot /></header>', props: ['title', 'crumb'] }

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
      InputText: inputStub,
      InputTextarea: textareaStub,
      AppAlert: alertStub,
    },
  },
}

describe('Settings page (/settings)', () => {
  it('renders without crashing and matches snapshot', () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.find('.set-layout').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the side navigation with all 6 sections', () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.findAll('.set-nav a')).toHaveLength(6)
  })

  it('renders all 6 settings sections', () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.findAll('.sect')).toHaveLength(6)
  })

  it('renders the 6 map style options', () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.findAll('.map-style')).toHaveLength(6)
  })

  it('toggles map style selection', async () => {
    const wrapper = mount(SettingsPage, globalConfig)
    const styles = wrapper.findAll('.map-style')
    await styles[1].trigger('click')
    expect(styles[1].classes()).toContain('is-active')
    expect(styles[0].classes()).not.toContain('is-active')
  })

  it('toggles unit selection', async () => {
    const wrapper = mount(SettingsPage, globalConfig)
    const buttons = wrapper.findAll('.segmented button')
    await buttons[1].trigger('click')
    expect(buttons[1].classes()).toContain('is-active')
    expect(buttons[0].classes()).not.toContain('is-active')
  })

  it('shows delete confirmation modal when delete button is clicked', async () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.find('.modal-scrim').classes()).not.toContain('is-open')
    await wrapper.find('.danger .btn').trigger('click')
    expect(wrapper.find('.modal-scrim').classes()).toContain('is-open')
  })

  it('closes delete modal when cancel is clicked', async () => {
    const wrapper = mount(SettingsPage, globalConfig)
    await wrapper.find('.danger .btn').trigger('click')
    await wrapper.find('.modal .btn--ghost').trigger('click')
    expect(wrapper.find('.modal-scrim').classes()).not.toContain('is-open')
  })

  it('shows saved toast when save button is clicked', async () => {
    const wrapper = mount(SettingsPage, globalConfig)
    expect(wrapper.find('.saved-bar').classes()).not.toContain('show')
    await wrapper.find('.btn--primary').trigger('click')
    expect(wrapper.find('.saved-bar').classes()).toContain('show')
  })
})
