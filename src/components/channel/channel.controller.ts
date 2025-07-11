import { DolphControllerHandler } from "@dolphjs/dolph/classes";
import {
  Dolph,
  SuccessResponse,
  DRequest,
  DResponse,
  BadRequestException,
} from "@dolphjs/dolph/common";
import { Get, Post, Route, Shield } from "@dolphjs/dolph/decorators";
import { ChannelService } from "./channel.service";
import { authShield } from "@/shared/shields/auth.shield";
import { CreateChannelDto } from "./channel.dto";
import { AccountService } from "../account/account.service";
import { EmailsService } from "../emails/emails.service";
import { IAccount } from "../account/account.model";

@Shield(authShield)
@Route("channel")
export class ChannelController extends DolphControllerHandler<Dolph> {
  ChannelService: ChannelService;
  AccountService: AccountService;
  EmailsService: EmailsService;
  constructor() {
    super();
  }

  @Post()
  async createChannel(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;

    const addresses = await this.AccountService.getWalletAddressesByUsernames(
      req.body.invitedMembers
    );

    const data = await this.ChannelService.createChannel(
      user,
      req.payload.info.balance,
      {
        ...(req.body as CreateChannelDto),
        invitedMembers: addresses.data,
        // invitedMembers: [
        // "0xBf197A09B145E24fb2279BdB8A263D9D7fddD872",
        // "0x3e9bbE264Bf323504D925d0FeaF899946C2Fbe68",
        // ],
      }
    );

    this.EmailsService.sendChannelInviteMail(
      addresses.users,
      data.channelAddress
    );

    SuccessResponse({ res, body: data });
  }

  @Get("active-members/:address")
  async fetchActiveMembers(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const result = await this.ChannelService.fetchActiveMembers(contract);

    SuccessResponse({ res, body: result });
  }

  @Get("all")
  async getChannels(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const result = await this.ChannelService.fetchAllDeployedChannels(user);

    SuccessResponse({ res, body: result });
  }

  @Get("/:address")
  async getChannelDetails(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const result = await this.ChannelService.getChannelDetails(contract);

    SuccessResponse({ res, body: result });
  }

  @Get("member-status/:address")
  async getMemberAddress(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;
    const username = req.query.username as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const walletAddress = await this.AccountService.getWalletAddressByUsername(
      username
    );

    if (!walletAddress) throw new BadRequestException("Username is invalid");

    const result = await this.ChannelService.getMemberStatus(
      contract,
      walletAddress.data
    );

    SuccessResponse({ res, body: result });
  }

  @Post("accept-invite/:address")
  async acceptInvite(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const result = await this.ChannelService.acceptInvite(
      contract,
      req.payload.info.balance
    );

    SuccessResponse({ res, body: result });
  }

  @Post("lock-channel/:address")
  async lockChannel(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const result = await this.ChannelService.lockChannel(contract);

    SuccessResponse({ res, body: result });
  }

  @Post("make-contribution/:address")
  async makeContribution(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const amount = req.body.amount;

    if (!amount)
      throw new BadRequestException("Provide amount to be contributed");

    const result = await this.ChannelService.makeContribution(
      contract,
      amount,
      req.payload.info.balance
    );

    SuccessResponse({ res, body: result });
  }

  @Post("payout/:address")
  async makePayout(req: DRequest, res: DResponse) {
    const user = req.payload.sub as string;
    const address = req.params.address as string;

    const contract = await this.ChannelService.getChannelContract(
      user,
      address
    );

    const result = await this.ChannelService.makeMonthlyDisbursement(
      contract,
      address,
      (req.payload.info as IAccount).walletAddress
    );

    SuccessResponse({ res, body: result });
  }
}
