import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseSkeleton from '@/components/BaseSkeleton.vue'

describe('BaseSkeleton', () => {
  it('is decorative', () => {
    expect(mount(BaseSkeleton).attributes('aria-hidden')).toBe('true')
  })

  it('applies the requested size and variant', () => {
    const wrapper = mount(BaseSkeleton, {
      props: { variant: 'block', width: '50%', height: '8rem' },
    })

    expect(wrapper.classes()).toContain('skeleton--block')
    expect(wrapper.attributes('style')).toContain('width: 50%')
    expect(wrapper.attributes('style')).toContain('height: 8rem')
  })
})
