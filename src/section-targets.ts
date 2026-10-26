import { type QuestionBlock, questionBlocks } from '#/src/question-blocks'

export interface SectionSource {
	readonly text: string
	readonly lineStart: number
	readonly lineEnd: number
}

/** Section text is the document; section line numbers narrow it without trusting data-line. */
export const sectionTargets = (section: SectionSource, renderedCount: number): QuestionBlock[] => {
	const targets = questionBlocks(section.text)
		.flatMap((block) =>
			block.slots.flatMap((slot) =>
				slot.line >= section.lineStart && slot.line <= section.lineEnd
					? [{ block, line: slot.line }]
					: [],
			),
		)
		.toSorted((a, b) => a.line - b.line)

	return targets.length === renderedCount ? targets.map((entry) => entry.block) : []
}
