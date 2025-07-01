import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import { Dolph } from "@dolphjs/dolph/common";
import { InjectMongo } from "@dolphjs/dolph/decorators";
import { Model } from "mongoose";
import { EmailsModel, IEmails } from "./emails.model";
import { IAccount } from "../account/account.model";
import { sendChannelInvite } from "@/shared/helpers/mail_sender";

// @InjectMongo("emailsModel", EmailsModel)
export class EmailsService extends DolphServiceHandler<Dolph> {
  // emailsModel!: Model<IEmails>;

  constructor() {
    super("emailsservice");
  }

  sendChannelInviteMail(users: IAccount[], address: string) {
    for (const user of users) {
      sendChannelInvite(user.email, address, user.username);
    }
    return;
  }
}
