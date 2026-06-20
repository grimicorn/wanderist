import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TripDetailPage from '../trips/[id].vue'

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: '<svg data-icon />' },
      NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
    },
  },
}

describe('Trip Detail page (/trips/[id])', () => {
  it('renders without crashing and matches snapshot', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.thero').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the hero with trip title', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.thero h1').text()).toContain('Iceland')
  })

  it('renders the itinerary with stops', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.findAll('.stop').length).toBeGreaterThan(0)
  })

  it('marks completed stops with is-done', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.findAll('.stop.is-done').length).toBeGreaterThan(0)
  })

  it('marks the next stop with is-next', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.stop.is-next').exists()).toBe(true)
  })

  it('renders the right rail with trip facts', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.trail').exists()).toBe(true)
    expect(wrapper.findAll('.fact').length).toBeGreaterThan(0)
  })

  it('renders the mini map', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.mini-map').exists()).toBe(true)
  })

  it('renders companions', () => {
    const wrapper = mount(TripDetailPage, globalConfig)
    expect(wrapper.find('.companions').exists()).toBe(true)
    expect(wrapper.html()).toContain('Maya R.')
  })
})
