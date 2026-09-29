import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase.js'
import { useOnline } from './lib/useOnline.js'
import Login from './screens/Login.jsx'
import Today from './screens/Today.jsx'
import ClassDetail from './screens/ClassDetail.jsx'
import ClassNew from './screens/ClassNew.jsx'
import Payments from './screens/Payments.jsx'
import Members from './screens/Members.jsx'
import MemberNew from './screens/MemberNew.jsx'
import MemberDetail from './screens/MemberDetail.jsx'
import Groups from './screens/Groups.jsx'
import GroupNew from './screens/GroupNew.jsx'
import GroupDetail from './screens/GroupDetail.jsx'
import GroupMessage from './screens/GroupMessage.jsx'
import Plans from './screens/Plans.jsx'
import Shop from './screens/Shop.jsx'
import ProductEdit from './screens/ProductEdit.jsx'
import Settings from './screens/Settings.jsx'
import Import from './screens/Import.jsx'
import Insights from './screens/Insights.jsx'
import TabBar from './components/TabBar.jsx'
import { ToastProvider } from './components/Toast.jsx'

export default function App() {
  // undefined = still checking, null = logged out, object = logged in
  const [session, setSession] = useState(undefined)
  const online = useOnline()
  const { pathname } = useLocation()

  // Start every new screen at the top (the browser would keep the old scroll position).
  // Braces matter: newer browsers make scrollTo return a Promise, and React
  // would try to call whatever the effect returns when the screen changes.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Runs whenever she logs in or out (or the login is renewed).
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <main className="screen center">
        <p>La app todavía no está conectada a la base de datos.</p>
        <p className="muted">Developer: copy .env.example to .env and fill in the Supabase values.</p>
      </main>
    )
  }

  if (session === undefined) {
    return <main className="screen center"><p className="muted">Cargando…</p></main>
  }

  return (
    <>
      {!online && (
        <div className="offline-banner" role="alert">
          No hay internet. Conectate al Wi-Fi para ver y guardar tus datos.
        </div>
      )}

      {session === null ? (
        <Login />
      ) : (
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/class/new" element={<ClassNew />} />
            <Route path="/class/:id" element={<ClassDetail />} />
            <Route path="/class/slot/:slotId/:date" element={<ClassDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/new" element={<MemberNew />} />
            <Route path="/members/:id" element={<MemberDetail />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/new" element={<GroupNew />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
            <Route path="/groups/:id/message" element={<GroupMessage />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/new" element={<ProductEdit />} />
            <Route path="/shop/:id" element={<ProductEdit />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/import" element={<Import />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <TabBar />
        </ToastProvider>
      )}
    </>
  )
}
