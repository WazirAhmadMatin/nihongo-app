import { useEffect, useState } from 'react'

export function useTelegram() {
  const tg = window.Telegram?.WebApp
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0a0a0f')
      tg.setBackgroundColor('#0a0a0f')
      setReady(true)
    } else {
      // Dev mode without Telegram
      setReady(true)
    }
  }, [])

  const userId = tg?.initDataUnsafe?.user?.id ?? 999999

  return { tg, userId, ready }
}
