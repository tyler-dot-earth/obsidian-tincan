import { Schema } from 'effect'

export class AnswerError extends Schema.TaggedError<AnswerError>()('AnswerError', {
	message: Schema.String,
}) {}
