import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapPage from '../map.vue'

const iconStub = { template: '<svg data-icon />' }
const topbarStub = { template: '<header class="topbar"><slot /></header>', props: ['title', 'crumb'] }
const linkStub = { template: '<a><slot /></a>', props: ['to'] }

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
      NuxtLink: linkStub,
    },
  },
}

describe('Map page (/map)', () => {
  it('renders the map stage and matches snapshot', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.find('.map-stage').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the places panel with 6 places', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.findAll('.place-item')).toHaveLength(6)
  })

  it('renders 6 pins on the map', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.findAll('.pin-abs')).toHaveLength(6)
  })

  it('renders 4 filter chips', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.findAll('.chip')).toHaveLength(4)
  })

  it('activates filter chip when clicked', async () => {
    const wrapper = mount(MapPage, globalConfig)
    const chips = wrapper.findAll('.chip')
    await chips[1].trigger('click')
    expect(chips[1].classes()).toContain('is-active')
    expect(chips[0].classes()).not.toContain('is-active')
  })

  it('shows detail card on initial load (Reykjavík selected)', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.find('.detail.is-open').exists()).toBe(true)
    expect(wrapper.find('.detail__name').text()).toBe('Reykjavík')
  })

  it('updates detail card when a place is selected', async () => {
    const wrapper = mount(MapPage, globalConfig)
    const items = wrapper.findAll('.place-item')
    await items[1].trigger('click')
    expect(wrapper.find('.detail__name').text()).toBe('Lisbon')
  })

  it('closes detail card when close button is clicked', async () => {
    const wrapper = mount(MapPage, globalConfig)
    await wrapper.find('.detail__close').trigger('click')
    expect(wrapper.find('.detail.is-open').exists()).toBe(false)
  })

  it('renders 6 map style options', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.findAll('.lstyle')).toHaveLength(6)
  })

  it('defaults to outdoors map style', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.find('.map-stage').attributes('data-mapstyle')).toBe('outdoors')
  })

  it('changes map style when a style is selected', async () => {
    const wrapper = mount(MapPage, globalConfig)
    const styles = wrapper.findAll('.lstyle')
    await styles[2].trigger('click')
    expect(wrapper.find('.map-stage').attributes('data-mapstyle')).toBe('satellite')
  })

  it('toggles the layers popover when button is clicked', async () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.find('.layers-pop.is-open').exists()).toBe(false)
    await wrapper.find('.map-cbtn').trigger('click')
    expect(wrapper.find('.layers-pop.is-open').exists()).toBe(true)
  })

  it('closes the layers popover after selecting a style', async () => {
    const wrapper = mount(MapPage, globalConfig)
    await wrapper.find('.map-cbtn').trigger('click')
    await wrapper.findAll('.lstyle')[1].trigger('click')
    expect(wrapper.find('.layers-pop.is-open').exists()).toBe(false)
  })

  it('shows the legend with current style name', () => {
    const wrapper = mount(MapPage, globalConfig)
    expect(wrapper.find('.legend').text()).toContain('outdoors-v12')
    expect(wrapper.find('.legend').text()).toContain('117 pins')
  })

  it('filters place list when search is typed', async () => {
    const wrapper = mount(MapPage, globalConfig)
    const input = wrapper.find('.places__search input')
    await input.setValue('tokyo')
    expect(wrapper.findAll('.place-item')).toHaveLength(1)
    expect(wrapper.find('.place-item__name').text()).toBe('Tokyo')
  })
})
