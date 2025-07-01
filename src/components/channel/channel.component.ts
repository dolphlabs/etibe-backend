import { Component } from "@dolphjs/dolph/decorators";
import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";
import { AccountService } from "../account/account.service";

@Component({
  controllers: [ChannelController],
  services: [ChannelService, AccountService],
})
export class ChannelComponent {}
