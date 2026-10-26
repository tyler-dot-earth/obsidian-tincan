import { type QuestionBlock, questionBlocks } from '#/src/question-blocks'

export interface SectionSource {
	readonly text: string
	readonly lineStart: number
	readonly lineEnd: number
}

/** Section text is the document; section line numbers narrow it without trusting data-line. */
export const sectionTargets = (section: SectionSource, renderedCount: number): QuestionBlock[] => {
	const targets = questionBlocks(section.text).filter(
		(block) => block.line >= section.lineStart && block.line <= section.lineEnd,
	)

	return targets.length === renderedCount ? targets : []
}
