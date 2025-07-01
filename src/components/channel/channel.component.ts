import { Component } from "@dolphjs/dolph/decorators";
import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";
import { AccountService } from "../account/account.service";
import { EmailsService } from "../emails/emails.service";

@Component({
  controllers: [ChannelController],
  services: [ChannelService, AccountService, EmailsService],
})
export class ChannelComponent {}
