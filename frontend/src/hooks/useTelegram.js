import { useEffect, useState } from 'react'

export function useTelegram() {
  const tg = window.Telegram?.WebApp
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor?.('secondary_bg_color')
      // colors follow the app theme
      setReady(true)
    } else {
      // Dev mode without Telegram
      setReady(true)
    }
  }, [])

  const userId = tg?.initDataUnsafe?.user?.id ?? 999999

  return { tg, userId, ready }
}
