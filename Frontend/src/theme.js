// antd v6 reads these tokens for every widget it renders — one place maps the brand onto buttons,
// inputs, tabs, tables and panels. Kept in step with styles/tokens.css by hand; the two lists are short.
const theme = {
    token: {
        colorPrimary: "#007582",
        colorLink: "#007582",
        colorText: "#1E2A38",
        colorTextHeading: "#1E2A38",
        colorBgLayout: "#FBFAF6",
        colorBorder: "#E7E3DA",
        colorBorderSecondary: "#EFECE5",
        fontFamily: "\"Lato\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        fontSize: 16,
        borderRadius: 12,
        controlHeight: 44,         // every control is a comfortable tap target on a phone
    },
    components: {
        Button: { fontWeight: 700, primaryShadow: "none" },
        Collapse: { headerBg: "#FFFFFF", contentBg: "#FFFFFF" },
        Tabs: { itemSelectedColor: "#007582", inkBarColor: "#007582" },
        Table: { headerBg: "#F6F4EE" },
    },
}

export default theme
