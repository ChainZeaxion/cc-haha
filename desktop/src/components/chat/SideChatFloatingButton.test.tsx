import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SideChatFloatingButton } from './SideChatFloatingButton'

const button = () => screen.getByRole('button', { name: 'Open side chat' })
const opacityOf = () => button().style.opacity

function renderButton(onPress = vi.fn()) {
  render(<SideChatFloatingButton label="Open side chat" onPress={onPress} />)
  return onPress
}

beforeEach(() => {
  vi.useFakeTimers()
})

/** Fake-timer ticks that flush the React update the timer is about to cause. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SideChatFloatingButton', () => {
  it('rests semi-transparent, so the conversation reads past it', () => {
    renderButton()

    // Not invisible — it has to be findable — but not competing with the history.
    expect(opacityOf()).toBe('0.65')
  })

  it('fades further on a tap and comes back on its own', () => {
    const onPress = renderButton()

    fireEvent.click(button())

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(opacityOf()).toBe('0.15')

    advance(3000)
    expect(opacityOf()).toBe('0.65')
  })

  it('holds the faded state for the full three seconds, not less', () => {
    renderButton()

    fireEvent.click(button())
    advance(2999)
    expect(opacityOf()).toBe('0.15')

    advance(1)
    expect(opacityOf()).toBe('0.65')
  })

  it('measures the hold from the latest tap rather than the first', () => {
    renderButton()

    fireEvent.click(button())
    advance(2000)
    // A second tap restarts the hold: the earlier timer must not end it early.
    fireEvent.click(button())
    advance(2000)
    expect(opacityOf()).toBe('0.15')

    advance(1000)
    expect(opacityOf()).toBe('0.65')
  })

  it('reports whether the panel is open', () => {
    render(<SideChatFloatingButton label="Open side chat" pressed onPress={vi.fn()} />)

    expect(button()).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets go of its timer when unmounted mid-hold', () => {
    // A tab switch can unmount this while the fade is still running; a pending
    // timer would then fire against a component that is gone.
    const { unmount } = render(<SideChatFloatingButton label="Open side chat" onPress={vi.fn()} />)

    fireEvent.click(button())
    unmount()

    expect(() => advance(5000)).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
