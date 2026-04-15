const LIVE_ARTIFACT_SESSION_KEY = 'id8.liveArtifact.v1';
const LIVE_ARTIFACT_EXIT_NOTICE_KEY = 'id8.liveArtifact.exitNotice.v1';
const LIVE_ARTIFACT_SHARED_PLAN_PREFIX = 'id8.liveArtifact.sharedPlan.v1.';
const LIVE_ARTIFACT_HOME_STATE_KEY = 'id8.liveArtifact.home.v1';
export function saveLiveArtifactSession(payload) {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.setItem(LIVE_ARTIFACT_SESSION_KEY, JSON.stringify(payload));
}
export function loadLiveArtifactSession() {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_SESSION_KEY);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function createLiveArtifactPlanId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `plan_${Date.now()}`;
}
function getSharedPlanKey(planId) {
    return `${LIVE_ARTIFACT_SHARED_PLAN_PREFIX}${planId}`;
}
export function saveSharedLiveArtifactPlan(planId, payload) {
    if (typeof window === 'undefined' || !planId) {
        return;
    }
    try {
        window.localStorage.setItem(getSharedPlanKey(planId), JSON.stringify(payload));
    }
    catch {
        // noop
    }
}
export function loadSharedLiveArtifactPlan(planId) {
    if (typeof window === 'undefined' || !planId) {
        return null;
    }
    const raw = window.localStorage.getItem(getSharedPlanKey(planId));
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function saveLiveArtifactHomeState(state) {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.setItem(LIVE_ARTIFACT_HOME_STATE_KEY, JSON.stringify(state));
}
export function loadLiveArtifactHomeState() {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_HOME_STATE_KEY);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function setLiveArtifactExitNotice(notice) {
    if (typeof window === 'undefined') {
        return;
    }
    const payload = typeof notice === 'string' ? { message: notice } : notice;
    window.sessionStorage.setItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY, JSON.stringify(payload));
}
export function consumeLiveArtifactExitNotice() {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY);
    if (!raw) {
        return null;
    }
    window.sessionStorage.removeItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY);
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.message === 'string') {
            return parsed;
        }
        return null;
    }
    catch {
        return { message: raw };
    }
}
