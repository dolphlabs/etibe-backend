import { Component } from "@dolphjs/dolph/decorators";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";
import { TokenService } from "../token/token.service";

@Component({
  controllers: [AccountController],
  services: [AccountService, TokenService],
})
export class AccountComponent {}
