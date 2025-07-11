import { DolphFactory } from "@dolphjs/dolph";
import { AccountComponent } from "./components/account/account.component";
import { ChannelComponent } from "./components/channel/channel.component";

const dolph = new DolphFactory([AccountComponent, ChannelComponent]);

dolph.enableHemet();

dolph.start();
