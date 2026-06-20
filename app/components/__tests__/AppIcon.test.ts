import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppIcon from '../AppIcon.vue'

describe('AppIcon', () => {
  it('renders the compass icon', () => {
    const wrapper = mount(AppIcon, { props: { name: 'compass' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the pin icon', () => {
    const wrapper = mount(AppIcon, { props: { name: 'pin' } })
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders a custom size', () => {
    const wrapper = mount(AppIcon, { props: { name: 'search', size: 32 } })
    expect(wrapper.find('svg').attributes('width')).toBe('32')
    expect(wrapper.find('svg').attributes('height')).toBe('32')
  })

  it('defaults to size 24', () => {
    const wrapper = mount(AppIcon, { props: { name: 'bell' } })
    expect(wrapper.find('svg').attributes('width')).toBe('24')
  })

  it('renders empty for unknown icon names', () => {
    const wrapper = mount(AppIcon, { props: { name: 'nonexistent-icon' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('svg').html()).toMatchSnapshot()
  })

  it('sets aria-hidden on the svg', () => {
    const wrapper = mount(AppIcon, { props: { name: 'star' } })
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })
})
