import { jsx as _jsx } from "react/jsx-runtime";
export function ProgressDots({ total, current }) {
    return (_jsx("div", { className: "progress-dots", "aria-label": `Step ${current} of ${total}`, children: Array.from({ length: total }, (_, index) => index + 1).map((value) => (_jsx("span", { className: `progress-dot${value <= current ? ' active' : ''}`, "aria-hidden": "true" }, value))) }));
}
