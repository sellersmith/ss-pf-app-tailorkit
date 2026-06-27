import mongoose from '~/bootstrap/db/connect-db.server'
import type { Document, Model, Types as MongooseTypes } from 'mongoose'
import { Schema } from 'mongoose'

// Interface for the Mongoose document (full Mongoose document instance)
export interface ConnectedClientDocument extends Document {
  clientId: string
  serverId: string
  connectedAt: Date
  lastPingAt: Date
  socketId: string
  // createdAt and updatedAt are also available due to { timestamps: true }
}

// Interface for the plain JavaScript object (when using .lean())
export interface ConnectedClientPojo {
  _id: MongooseTypes.ObjectId // lean() includes _id
  clientId: string
  serverId: string
  connectedAt: Date
  lastPingAt: Date
  socketId: string
  createdAt?: Date // from timestamps
  updatedAt?: Date // from timestamps
  __v?: number // lean() can also include __v by default
}

// Mongoose Schema for ConnectedClientDocument
const ConnectedClientSchema = new Schema<ConnectedClientDocument>(
  {
    clientId: { type: String, required: true, index: true, unique: true },
    serverId: { type: String, required: true, index: true },
    socketId: { type: String, required: true },
    // connectedAt and lastPingAt will be set on creation by the application logic
    // Mongoose `timestamps: true` handles createdAt and updatedAt
    connectedAt: { type: Date, required: true }, // Explicitly set on creation
    lastPingAt: { type: Date, required: true }, // Explicitly set on creation/update
  },
  { timestamps: true } // Adds createdAt and updatedAt
)

// Mongoose Model for ConnectedClient
// Ensures the model is not recompiled if it already exists
const ConnectedClientModel = (mongoose.models.ConnectedClient
  || mongoose.model<ConnectedClientDocument>(
    'ConnectedClient',
    ConnectedClientSchema,
    'connected_clients_registry' // Explicitly set collection name
  )) as Model<ConnectedClientDocument>

export default ConnectedClientModel
