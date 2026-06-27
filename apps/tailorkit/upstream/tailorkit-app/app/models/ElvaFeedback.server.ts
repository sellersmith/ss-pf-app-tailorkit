// app/models/ElvaFeedback.server.ts
import mongoose from '~/bootstrap/db/connect-db.server'

const ElvaFeedbackSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  messageId: { type: String, required: true },
  replyText: { type: String, required: true },
  kbRowsCited: [{ type: String, index: true }], // supabase documentation IDs
  signal: { type: String, enum: ['implicit_down', 'implicit_up', 'neutral'], required: true },
  triggerKeywords: [{ type: String }], // which keywords fired (for auditing heuristic)
  nextUserMessage: { type: String }, // truncated 500 chars
  shopDomain: { type: String, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
})

ElvaFeedbackSchema.index({ kbRowsCited: 1, signal: 1, createdAt: -1 })

export default mongoose.models.ElvaFeedback || mongoose.model('ElvaFeedback', ElvaFeedbackSchema)
