import { useEffect, useState } from 'react'

// Telegram Mini App setup. Colours follow Telegram's theme (see index.css);
// in an ordinary browser we follow the system light/dark setting.
export function useTelegram() {
  const tg = window.Telegram?.WebApp
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = tg?.colorScheme ? tg.colorScheme === 'dark' : media.matches
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor?.('secondary_bg_color')
      tg.setBackgroundColor?.('secondary_bg_color')
      tg.onEvent?.('themeChanged', apply)
    } else {
      media.addEventListener?.('change', apply)
    }
    setReady(true)
    return () => {
      tg?.offEvent?.('themeChanged', apply)
      media.removeEventListener?.('change', apply)
    }
  }, [])

  const userId = tg?.initDataUnsafe?.user?.id ?? 999999
  return { tg, userId, ready }
}
