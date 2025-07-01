import { Schema, Document, model } from "mongoose";

export interface IEmails extends Document {
  
}

const EmailsSchema = new Schema(
    {

    }
);

export const EmailsModel = model<IEmails>("emailss", EmailsSchema);
