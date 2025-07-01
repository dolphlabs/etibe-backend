import { Component } from "@dolphjs/dolph/decorators";
import { EmailsController } from "./emails.controller";

@Component({ controllers: [EmailsController], services: [] })
export class EmailsComponent {}
