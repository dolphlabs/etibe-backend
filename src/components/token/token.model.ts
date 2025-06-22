import { Document, model, Model, Schema, Types } from "mongoose";

export interface IToken extends Document {
  token: string;
  accountId: string;
  type: string;
  expires: string;
}

const tokenSchema = new Schema({
  token: {
    type: String,
    required: true,
  },
  accountId: {
    type: Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ["refresh", "access", "payment", "invite"],
    default: "refresh",
  },
  expires: {
    type: String,
    required: true,
  },
});

export const TokenModel: Model<IToken> = model<IToken>("tokens", tokenSchema);
