import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InputText from '../InputText.vue'

const iconStub = { template: '<svg data-icon />' }

describe('InputText', () => {
  it('renders a text input by default', () => {
    const wrapper = mount(InputText, {
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders a label when provided', () => {
    const wrapper = mount(InputText, {
      props: { label: 'Email' },
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.find('label').text()).toContain('Email')
  })

  it('links label to input via id', () => {
    const wrapper = mount(InputText, {
      props: { label: 'Name' },
      global: { stubs: { AppIcon: iconStub } },
    })
    const labelFor = wrapper.find('label').attributes('for')
    const inputId = wrapper.find('input').attributes('id')
    expect(labelFor).toBe(inputId)
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(InputText, {
      props: { modelValue: '' },
      global: { stubs: { AppIcon: iconStub } },
    })
    await wrapper.find('input').setValue('hello')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['hello'])
  })

  it('applies is-error class in error state', () => {
    const wrapper = mount(InputText, {
      props: { state: 'error', hint: 'Required' },
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.classes()).toContain('is-error')
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('applies is-success class in success state', () => {
    const wrapper = mount(InputText, {
      props: { state: 'success' },
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.classes()).toContain('is-success')
  })

  it('shows hint text', () => {
    const wrapper = mount(InputText, {
      props: { hint: 'Use your work email' },
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.find('.field__hint').text()).toBe('Use your work email')
  })

  it('passes disabled to input', () => {
    const wrapper = mount(InputText, {
      props: { disabled: true },
      global: { stubs: { AppIcon: iconStub } },
    })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })
})
