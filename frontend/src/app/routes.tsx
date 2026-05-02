import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { AbstractsPage } from './pages/AbstractsPage'
import { MatchHistoryPage } from './pages/MatchHistoryPage'
import { AccountPage } from './pages/AccountPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'abstracts', Component: AbstractsPage },
      { path: 'match-history', Component: MatchHistoryPage },
      { path: 'account', Component: AccountPage },
    ],
  },
])
