export { Tape } from './components/Tape'
export { useTape } from './hooks/useTape'
export { Recorder } from './core/recorder'
export { mergeComments, buildReport, exportMarkdown, exportAgentInstructions, exportJSON, detectSentiment } from './core/reporter'

export type {
  TapeProps,
  Recording,
  Marker,
  Segment,
  Comment,
  Sentiment,
  CritiqueReport,
} from './types'

export { TAPE_COLORS, SENTIMENT_CONFIG } from './types'
