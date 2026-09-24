import React from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "react-redux"
import { store } from "./store/store"
import { ConfigProvider } from "antd"
import App from "./App"
import theme from "./theme"
// fonts are bundled with the site, not fetched from Google: no third-party request on a site for
// minors, and no layout jump while a remote stylesheet loads
import "@fontsource/lato/400.css"
import "@fontsource/lato/700.css"
import "@fontsource/lato/900.css"
import "@fontsource/orelega-one/400.css"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/components.css"
import "./styles/public.css"

const root = ReactDOM.createRoot(document.getElementById("root"))

root.render(
    <React.StrictMode>
        <Provider store={store}>
            <ConfigProvider theme={theme}>
                <App />
            </ConfigProvider>
        </Provider>
    </React.StrictMode>
)
