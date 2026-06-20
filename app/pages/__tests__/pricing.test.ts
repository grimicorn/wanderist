import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PricingPage from '../pricing.vue'

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: '<svg data-icon />' },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
    },
  },
}

describe('Pricing page (/pricing)', () => {
  it('renders without crashing and matches snapshot', () => {
    const wrapper = mount(PricingPage, globalConfig)
    expect(wrapper.find('table.cmp').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('shows monthly prices by default', () => {
    const wrapper = mount(PricingPage, globalConfig)
    expect(wrapper.html()).toContain('$8')
    expect(wrapper.html()).toContain('$16')
  })

  it('switches to yearly pricing when yearly button is clicked', async () => {
    const wrapper = mount(PricingPage, globalConfig)
    const buttons = wrapper.findAll('.billing button')
    await buttons[1].trigger('click')
    expect(wrapper.html()).toContain('$6')
    expect(wrapper.html()).toContain('$12')
    expect(wrapper.html()).toContain('/mo·yr')
  })

  it('has the three plan columns', () => {
    const wrapper = mount(PricingPage, globalConfig)
    expect(wrapper.find('.thd--pop').exists()).toBe(true)
    expect(wrapper.html()).toContain('Drifter')
    expect(wrapper.html()).toContain('Wanderer')
    expect(wrapper.html()).toContain('Nomad')
  })

  it('renders category rows', () => {
    const wrapper = mount(PricingPage, globalConfig)
    expect(wrapper.findAll('.cat-row').length).toBeGreaterThan(0)
  })

  it('highlights the Wanderer column as popular', () => {
    const wrapper = mount(PricingPage, globalConfig)
    expect(wrapper.find('.thd--pop').text()).toContain('Wanderer')
  })
})
