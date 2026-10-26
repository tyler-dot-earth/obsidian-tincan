/** Postprocessing can finish before a section enters its pane; do not guess a timeout. */
export const whenAttached = (element: HTMLElement, mount: () => void): (() => void) => {
	if (element.isConnected) {
		mount()

		return () => {}
	}

	const window = element.ownerDocument.defaultView

	if (window === null) return () => {}

	const observer = new window.MutationObserver(() => {
		if (!element.isConnected) return
		observer.disconnect()
		mount()
	})

	observer.observe(element.ownerDocument, { childList: true, subtree: true })

	return () => observer.disconnect()
}
