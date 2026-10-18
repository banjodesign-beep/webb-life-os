import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './app.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => reg.update().catch(() => {}))
    .catch((e) => console.warn('SW register failed', e))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
