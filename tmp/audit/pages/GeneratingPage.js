import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PageShell } from '../components/layout/PageShell';
export function GeneratingPage({ headline, detail }) {
    return (_jsx(PageShell, { title: "Curating Your Plan", subtitle: headline, children: _jsxs("div", { className: "generating-panel", children: [_jsx("span", { className: "loading-orb", "aria-hidden": "true" }), _jsx("p", { children: detail })] }) }));
}
