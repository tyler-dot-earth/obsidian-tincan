export type AnswerKind = 'text' | 'choice' | 'choices'

export interface ChoiceOption {
	readonly label: string
	readonly checked: boolean
}

export type AnswerContent =
	| { readonly kind: 'text'; readonly text: string }
	| {
			readonly kind: 'choice' | 'choices'
			readonly options: readonly ChoiceOption[]
			readonly other?: string
	  }

const validOptions = (
	kind: 'choice' | 'choices',
	options: readonly ChoiceOption[],
	other: string,
): boolean => {
	if (options.length === 0) return false

	if (new Set(options.map((option) => option.label)).size !== options.length) return false

	return (
		kind === 'choices' ||
		options.filter((option) => option.checked).length + (other.trim() === '' ? 0 : 1) <= 1
	)
}

interface PickBody {
	readonly lines: readonly string[]
	readonly other: string
}

const splitOther = (body: string): PickBody => {
	const lines = body.split('\n')
	const marker = lines.findIndex((line) => /^Other:(?:[ \t].*)?$/.test(line))

	const other =
		marker < 0
			? ''
			: [lines[marker]?.replace(/^Other:[ \t]?/, '') ?? '', ...lines.slice(marker + 1)]
					.join('\n')
					.trimEnd()

	return { lines: lines.slice(0, marker < 0 ? lines.length : marker), other }
}

/** Choice bodies deliberately support only flat, one-line Markdown task options. */
export const answerContent = (kind: AnswerKind, body: string): AnswerContent | undefined => {
	if (kind === 'text') return { kind: 'text', text: body }

	const { lines, other } = splitOther(body)
	const options: ChoiceOption[] = []

	for (const line of lines) {
		if (line.trim() === '') continue
		const match = /^- \[([ xX])\] (\S.*)$/.exec(line)

		if (match === null) return undefined
		options.push({ label: match[2] ?? '', checked: match[1] !== ' ' })
	}

	if (!validOptions(kind, options, other)) return undefined

	return { kind, options, other }
}

export const answerText = (content: AnswerContent): string => {
	if (content.kind === 'text') return content.text

	const options = content.options
		.map((option) => `- [${option.checked ? 'x' : ' '}] ${option.label}`)
		.join('\n')

	return (content.other ?? '') === '' ? options : options + '\n\nOther: ' + content.other
}

export const isAnswered = (content: AnswerContent): boolean =>
	content.kind === 'text'
		? content.text.trim() !== ''
		: content.options.some((option) => option.checked) || (content.other ?? '').trim() !== ''
