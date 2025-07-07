'use client'

import AuthGuard from '../../lib/authGuard'

export default function AdminPage() {
  return (
    <AuthGuard>
      <div>
        <h1>Panou de administrare</h1>
        {/* Aici adaugi conținutul panoului de control */}
      </div>
    </AuthGuard>
  )
}
