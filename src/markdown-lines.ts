export interface SourceLine {
	readonly text: string
	readonly ending: string
	readonly offset: number
}

export const lineEnding = (lines: readonly SourceLine[], header: SourceLine): string =>
	header.ending !== '' ? header.ending : (lines.find((line) => line.ending !== '')?.ending ?? '\n')

export const sourceLines = (source: string): SourceLine[] => {
	const lines: SourceLine[] = []
	const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g

	for (const match of source.matchAll(pattern)) {
		if (match[0] === '') break
		lines.push({ text: match[1] ?? '', ending: match[2] ?? '', offset: match.index })
	}

	return lines
}
