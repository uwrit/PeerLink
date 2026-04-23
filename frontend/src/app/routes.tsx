import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { AbstractsPage } from './pages/AbstractsPage'
import { MatchHistoryPage } from './pages/MatchHistoryPage'
import { AccountPage } from './pages/AccountPage'
import { ManualEntryPage } from './pages/ManualEntryPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'abstracts', Component: AbstractsPage },
      { path: 'manual-entry', Component: ManualEntryPage },
      { path: 'match-history', Component: MatchHistoryPage },
      { path: 'account', Component: AccountPage },
    ],
  },
])
