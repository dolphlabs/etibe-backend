import { DolphControllerHandler } from "@dolphjs/dolph/classes";
import {
  Dolph,
  SuccessResponse,
  DRequest,
  DResponse,
} from "@dolphjs/dolph/common";
import {
  Get,
  Patch,
  Post,
  Route,
  Shield,
  UnShield,
} from "@dolphjs/dolph/decorators";
import { AccountService } from "./account.service";
import { TokenService } from "../token/token.service";
import { authShield } from "@/shared/shields/auth.shield";

@Shield(authShield)
@Route("account")
export class AccountController extends DolphControllerHandler<Dolph> {
  private AccountService!: AccountService;
  private TokenService!: TokenService;

  @UnShield(authShield)
  @Post("signup")
  async signup(req: DRequest, res: DResponse) {
    const result = await this.AccountService.createAccount(req.body);

    SuccessResponse({ res, body: result });
  }

  @UnShield(authShield)
  @Post("verify-email")
  async verifyEmailOtp(req: DRequest, res: DResponse) {
    const result = await this.AccountService.verifyEmailOtp(req.body);

    const { accessExpiration, accessToken, refreshExpiration, refreshToken } =
      await this.TokenService.generateToken(result.data._id);

    result.data.accessExpiration = accessExpiration;
    result.data.accessToken = accessToken;
    result.data.refreshExpiration = refreshExpiration;
    result.data.refreshToken = refreshToken;

    SuccessResponse({ res, body: result });
  }

  @UnShield(authShield)
  @Post("login")
  async login(req: DRequest, res: DResponse) {
    const result = await this.AccountService.login(req.body);

    const { accessExpiration, accessToken, refreshExpiration, refreshToken } =
      await this.TokenService.generateToken(result.data._id);

    result.data.accessExpiration = accessExpiration;
    result.data.accessToken = accessToken;
    result.data.refreshExpiration = refreshExpiration;
    result.data.refreshToken = refreshToken;

    SuccessResponse({ res, body: result });
  }

  @Patch()
  async update(req: DRequest, res: DResponse) {
    const id = req.payload.sub as string;

    const result = await this.AccountService.updateProfile(req.body, id);

    SuccessResponse({ res, body: result });
  }
}
