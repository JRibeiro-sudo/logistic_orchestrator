import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useUIStore } from '@/stores/ui'

// Apply persisted theme before first paint (dark is the default).
const theme = useUIStore.getState().theme
document.documentElement.classList.toggle('light', theme === 'light')
document.documentElement.classList.toggle('dark', theme === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
