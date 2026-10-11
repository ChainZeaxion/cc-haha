import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'

/**
 * How long the tap feedback lasts, in ms.
 *
 * Long enough to be seen as a response to the tap rather than a flicker, short
 * enough that the button is back to its resting shade by the time the reader
 * looks at what the tap opened.
 */
const TAPPED_HOLD_MS = 3_000

/**
 * The side-chat toggle for the mobile layout, floating over the top-right of the
 * conversation instead of taking a row of its own.
 *
 * It sits *over* the history rather than beside it, so it has to be something a
 * reader can see past: semi-transparent at rest, because a conversation is the
 * thing being read and this is furniture. A tap fades it further for a moment —
 * the acknowledgement of the tap — and then it settles back.
 *
 * The wrapper ignores pointer events and only the button takes them, so the
 * circle never eats a tap meant for the message underneath.
 */
export function SideChatFloatingButton({
  label,
  pressed,
  onPress,
}: {
  label: string
  /** The panel is open — the toggle reads as engaged rather than as an action. */
  pressed?: boolean
  onPress: () => void
}) {
  const [tapped, setTapped] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A tab switch can unmount this mid-hold; the timer must not outlive it and
  // set state on a component that is gone.
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  const handlePress = useCallback(() => {
    setTapped(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      setTapped(false)
    }, TAPPED_HOLD_MS)
    onPress()
  }, [onPress])

  return (
    <div
      data-testid="side-chat-floating-button"
      className="pointer-events-none absolute right-3 top-2 z-[var(--z-dropdown)]"
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        data-tapped={tapped ? 'true' : 'false'}
        onClick={handlePress}
        className={[
          'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full',
          'border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)]',
          'text-[var(--color-text-secondary)] shadow-[var(--shadow-overlay)]',
          'transition-opacity duration-200 ease-out motion-reduce:transition-none',
          'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]',
          pressed ? 'text-[var(--color-brand)]' : '',
        ].filter(Boolean).join(' ')}
        style={{ opacity: tapped ? 0.15 : 0.65 }}
      >
        <MessageCircleQuestion size={18} />
      </button>
    </div>
  )
}
