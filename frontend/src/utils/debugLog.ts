/**
 * Minimal debug logging for sidebar unclickable bug.
 * Logs DOM state periodically to capture evidence when the bug occurs.
 * Enable with VITE_DEBUG_LOG_ENABLED=true in production.
 */
function getDebugEndpoint(): string | null {
  const enabled = (import.meta as { env?: { VITE_DEBUG_LOG_ENABLED?: string } }).env
    ?.VITE_DEBUG_LOG_ENABLED
  const apiUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
  if (enabled === "true" && apiUrl) {
    return `${apiUrl.replace(/\/$/, "")}/api/v1/debug/dom-state`
  }
  return null
}

function captureDomState(): Record<string, unknown> {
  const body = document.body
  const inertEls = document.querySelectorAll("[inert]")
  const ariaHiddenEls = document.querySelectorAll('[aria-hidden="true"]')
  const scopedDialog = document.querySelectorAll('[data-scope="dialog"]')
  const scopedDrawer = document.querySelectorAll('[data-scope="drawer"]')
  return {
    bodyInert: "inert" in body ? (body as HTMLBodyElement & { inert?: boolean }).inert : "n/a",
    bodyAriaHidden: body.getAttribute("aria-hidden"),
    bodyOverflow: body.style.overflow,
    inertElCount: inertEls.length,
    ariaHiddenElCount: ariaHiddenEls.length,
    dataScopeDialogCount: scopedDialog.length,
    dataScopeDrawerCount: scopedDrawer.length,
  }
}

export function debugLog(
  message: string,
  data: Record<string, unknown> = {},
): void {
  const endpoint = getDebugEndpoint()
  if (!endpoint) return

  const payload = {
    message,
    data: { ...data, ...captureDomState() },
    timestamp: Date.now(),
  }
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
