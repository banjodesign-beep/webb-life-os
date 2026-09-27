import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ReminderPrompt from './components/ReminderPrompt.jsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW register failed', e))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ReminderPrompt />
  </React.StrictMode>
)
