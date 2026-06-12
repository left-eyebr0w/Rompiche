import React from 'react'
import ReactDOM from 'react-dom/client'

/* Expose React globally so the pre-built DS bundle (_ds_bundle.js) can use it */
window.React = React

import '../../_ds_bundle.js'
import DioramaApp from './DioramaApp.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<DioramaApp />)
