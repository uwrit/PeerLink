import { RouterProvider } from 'react-router'
import { router } from './routes'
import { PeerLinkProvider } from './context/PeerLinkContext'

export default function App() {
  return (
    <PeerLinkProvider>
      <RouterProvider router={router} />
    </PeerLinkProvider>
  )
}
