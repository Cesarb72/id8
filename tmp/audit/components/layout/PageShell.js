import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PageShell({ title, subtitle, topSlot, footer, className, children }) {
    return (_jsxs("section", { className: className ? `page-shell ${className}` : 'page-shell', children: [topSlot, _jsxs("header", { className: "page-header", children: [_jsx("h1", { children: title }), subtitle && _jsx("p", { children: subtitle })] }), _jsx("div", { className: "page-body", children: children }), footer && _jsx("footer", { className: "page-footer", children: footer })] }));
}
