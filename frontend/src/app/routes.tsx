import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { AbstractsPage } from './pages/AbstractsPage'
import { MatchHistoryPage } from './pages/MatchHistoryPage'
import { AccountPage } from './pages/AccountPage'
import { FindReviewersPage } from './pages/FindReviewersPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'abstracts', Component: AbstractsPage },
      { path: 'find-reviewers', Component: FindReviewersPage },
      { path: 'match-history', Component: MatchHistoryPage },
      { path: 'settings', Component: SettingsPage },
      { path: 'account', Component: AccountPage },
    ],
  },
])
