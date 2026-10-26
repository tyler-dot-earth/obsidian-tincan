const excludedAncestors =
	'.callout, blockquote, .internal-embed, .markdown-embed, .popover, .hover-popover'

/** Count only callouts in the supported reading surface, including filled ones. */
export const answerCallouts = (element: HTMLElement): HTMLElement[] => {
	const selector = '.callout[data-callout="answer"], .callout[data-callout="question"]'
	const callouts = Array.from(element.querySelectorAll<HTMLElement>(selector))

	if (element.matches(selector)) callouts.unshift(element)

	return callouts.filter(
		(callout) => (callout.parentElement?.closest(excludedAncestors) ?? null) === null,
	)
}
