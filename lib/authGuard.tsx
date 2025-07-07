'use client'

import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { app } from './firebaseConfig'

interface AuthGuardProps {
  children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()

  useEffect(() => {
    const auth = getAuth(app)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login')
      }
    })
    return () => unsubscribe()
  }, [router])

  return <>{children}</>
}
