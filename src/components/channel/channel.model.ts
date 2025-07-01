import { Schema, Document, model } from "mongoose";

export interface IChannel extends Document {
  
}

const ChannelSchema = new Schema(
    {

    }
);

export const ChannelModel = model<IChannel>("channels", ChannelSchema);
