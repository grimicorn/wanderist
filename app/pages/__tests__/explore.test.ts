import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExplorePage from '../explore.vue'

const iconStub = { template: '<svg data-icon />' }
const topbarStub = { template: '<header class="topbar"><slot /></header>', props: ['title', 'crumb'] }

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
    },
  },
}

describe('Explore page (/explore)', () => {
  it('renders without crashing and matches snapshot', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.find('.xhero').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders the hero section with search input', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.find('.xhero h1').text()).toBe('Where to next?')
    expect(wrapper.find('.xsearch input').exists()).toBe(true)
  })

  it('renders 5 search chips', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.xchip')).toHaveLength(5)
  })

  it('sets hero search value when chip is clicked', async () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const chips = wrapper.findAll('.xchip')
    await chips[0].trigger('click')
    expect((wrapper.find('.xsearch input').element as HTMLInputElement).value).toBe('Cold-water swims')
  })

  it('renders 3 featured destination cards', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.feat')).toHaveLength(3)
  })

  it('renders featured destination titles', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const titles = wrapper.findAll('.feat__title').map((el) => el.text())
    expect(titles).toContain('The ring road, slowly')
    expect(titles).toContain('Lisbon to the Algarve')
    expect(titles).toContain('North to south by rail')
  })

  it('renders 6 place filter buttons', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.fbtn')).toHaveLength(6)
    expect(wrapper.find('.fbtn.is-active').text()).toBe('All')
  })

  it('switches active filter when clicked', async () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const filters = wrapper.findAll('.fbtn')
    await filters[1].trigger('click')
    expect(filters[1].classes()).toContain('is-active')
    expect(filters[0].classes()).not.toContain('is-active')
  })

  it('renders 4 trending place cards', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.pcard')).toHaveLength(4)
  })

  it('renders place card names', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const names = wrapper.findAll('.pcard__name').map((el) => el.text())
    expect(names).toContain('Reynisfjara')
    expect(names).toContain('Alfama')
  })

  it('renders 3 guide cards', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.guide')).toHaveLength(3)
  })

  it('renders 4 people to follow', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    expect(wrapper.findAll('.person')).toHaveLength(4)
  })

  it('shows one person already followed', () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const followBtns = wrapper.findAll('.person .btn')
    const followingBtn = followBtns.find((btn) => btn.classes().includes('btn--primary'))
    expect(followingBtn).toBeTruthy()
    expect(followingBtn?.text()).toContain('following')
  })

  it('toggles follow state when follow button is clicked', async () => {
    const wrapper = mount(ExplorePage, globalConfig)
    const followBtns = wrapper.findAll('.person .btn')
    const unfollowedBtn = followBtns.find((btn) => btn.text().trim() === 'follow')
    await unfollowedBtn?.trigger('click')
    expect(unfollowedBtn?.classes()).toContain('btn--primary')
    expect(unfollowedBtn?.text()).toContain('following')
  })
})
