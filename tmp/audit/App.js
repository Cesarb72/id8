import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { AppShell } from './app/AppShell';
import { DemoPage } from './pages/DemoPage';
import { HomePage } from './pages/HomePage';
import { LiveJourneyPage } from './pages/LiveJourneyPage';
import { SandboxConciergePage } from './pages/SandboxConciergePage';
import './App.css';
const ENVIRONMENT_LINKS = [
    { href: '/', label: 'Concierge' },
    { href: '/dev', label: 'Development Sandbox' },
    { href: '/archive', label: 'Archive' },
];
function EnvironmentAccessBar({ currentPath }) {
    return (_jsx("nav", { className: "environment-access-bar", "aria-label": "Environment quick access", children: _jsx("div", { className: "environment-access-inner", children: ENVIRONMENT_LINKS.map((link) => {
                const active = link.href === '/'
                    ? currentPath === '/'
                    : currentPath === link.href || currentPath.startsWith(`${link.href}/`);
                return (_jsx("a", { href: link.href, className: `environment-access-link${active ? ' active' : ''}`, "aria-current": active ? 'page' : undefined, children: link.label }, link.href));
            }) }) }));
}
function App() {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const normalizedPathname = pathname.toLowerCase();
    let page = _jsx(DemoPage, {});
    if (normalizedPathname === '/') {
        page = _jsx(DemoPage, {});
    }
    if (normalizedPathname === '/dev' || normalizedPathname === '/sandbox') {
        page = _jsx(AppShell, { environment: "dev" });
    }
    else if (normalizedPathname === '/dev/concierge' ||
        normalizedPathname === '/sandbox/concierge') {
        page = _jsx(SandboxConciergePage, {});
    }
    else if (normalizedPathname === '/archive') {
        page = _jsx(AppShell, { environment: "archive" });
    }
    else if (normalizedPathname === '/journey/live' || normalizedPathname === '/live') {
        page = _jsx(LiveJourneyPage, {});
    }
    else if (normalizedPathname === '/home') {
        page = _jsx(HomePage, {});
    }
    else {
        const sharedPlanMatch = pathname.match(/^\/p\/([^/]+)\/?$/i);
        if (sharedPlanMatch?.[1]) {
            page = _jsx(LiveJourneyPage, { sharedPlanId: decodeURIComponent(sharedPlanMatch[1]) });
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx(EnvironmentAccessBar, { currentPath: normalizedPathname }), page] }));
}
export default App;
