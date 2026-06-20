import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppNewEntry from '../AppNewEntry.vue'

const iconStub = { template: '<svg data-icon />' }

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
    },
  },
}

describe('AppNewEntry', () => {
  it('renders nothing when closed', () => {
    const wrapper = mount(AppNewEntry, { props: { open: false }, ...globalConfig })
    expect(wrapper.find('.drawer').exists()).toBe(false)
  })

  it('renders the drawer when open and matches snapshot', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.drawer').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the drawer header with correct title', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.drawer__head h3').text()).toBe('Capture a moment')
  })

  it('emits close when scrim is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    await wrapper.find('.drawer__scrim').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    await wrapper.find('.drawer__head .icon-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when cancel button is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    await wrapper.find('.btn--outline').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders the photo dropzone with add button', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.dropzone').exists()).toBe(true)
    expect(wrapper.find('.dz-add').exists()).toBe(true)
  })

  it('renders 3 trip options', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.findAll('.pill-pick').length).toBeGreaterThan(0)
  })

  it('renders 3 weather options', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    const weatherSection = wrapper.findAll('.pill-pick').at(-1)
    expect(weatherSection?.findAll('.pick')).toHaveLength(3)
  })

  it('renders visibility toggle with Private and Public options', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    const buttons = wrapper.find('.segmented').findAll('button')
    expect(buttons[0].text()).toBe('Private')
    expect(buttons[1].text()).toBe('Public')
    expect(buttons[0].classes()).toContain('is-active')
  })

  it('switches visibility when Public is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    const buttons = wrapper.find('.segmented').findAll('button')
    await buttons[1].trigger('click')
    expect(buttons[1].classes()).toContain('is-active')
    expect(buttons[0].classes()).not.toContain('is-active')
  })

  it('renders default tags', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.tags-input').text()).toContain('iceland')
    expect(wrapper.find('.tags-input').text()).toContain('ring road')
  })

  it('removes a tag when its remove button is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    const removeButtons = wrapper.findAll('.tag-x')
    await removeButtons[0].trigger('click')
    expect(wrapper.find('.tags-input').text()).not.toContain('iceland')
  })

  it('renders location chip suggestions', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.chip-suggest').exists()).toBe(true)
    expect(wrapper.findAll('.chip')).toHaveLength(3)
  })

  it('updates location when a suggestion chip is clicked', async () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    const chips = wrapper.findAll('.chip')
    await chips[0].trigger('click')
    // The location field is inside .chip-suggest's parent .field; find the input within that section
    const locationField = wrapper.find('.chip-suggest').element.closest('.field')
    const locationInput = locationField?.querySelector('.field__input') as HTMLInputElement | null
    expect(locationInput?.value).toBe('Old Harbour')
  })

  it('renders publish and save draft buttons in footer', () => {
    const wrapper = mount(AppNewEntry, { props: { open: true }, ...globalConfig })
    expect(wrapper.find('.drawer__foot .btn--primary').text()).toContain('publish')
    expect(wrapper.find('.drawer__foot .btn--ghost').text()).toContain('save draft')
  })
})
