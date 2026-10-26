import { Effect } from 'effect'

import { AnswerError, type AnswerTarget, writeAnswer } from '#/src/answer-target'

/** File identity is captured by the host, rather than looked up from the active note. */
export interface AnswerWriter {
	readonly available: () => boolean
	readonly editing: () => boolean
	readonly process: (transform: (source: string) => string) => Promise<string>
}

export const saveAnswer: (
	writer: AnswerWriter,
	target: AnswerTarget,
	answer: string,
) => Effect.Effect<string, AnswerError> = Effect.fn('Answer.saveAnswer')(
	function* (writer, target, answer) {
		return yield* Effect.tryPromise({
			try: () =>
				writer.process((source) => {
					if (!writer.available())
						throw new AnswerError({
							message: 'The original file is unavailable; your draft is kept.',
						})

					if (writer.editing())
						throw new AnswerError({
							message: 'Switch every copy of this note to reading view before saving.',
						})

					return writeAnswer(source, target, answer)
				}),
			catch: (cause) =>
				cause instanceof AnswerError
					? cause
					: new AnswerError({ message: 'Could not save the answer; your draft is kept.' }),
		})
	},
)
