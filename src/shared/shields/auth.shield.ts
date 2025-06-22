import { AccountService } from "@/components/account/account.service";
import {
  DNextFunc,
  DRequest,
  DResponse,
  ForbiddenException,
  IPayload,
  UnauthorizedException,
} from "@dolphjs/dolph/common";
import { verifyJWTwithHMAC } from "@dolphjs/dolph/utilities";
import { envConfigs } from "../configs/env.configs";

const accountService = new AccountService();

export const authShield = async (
  req: DRequest,
  res: DResponse,
  next: DNextFunc
) => {
  try {
    let authToken =
      req.headers["authorization"] || (req.headers["Authorization"] as string);

    if (!authToken) {
      return next(
        new UnauthorizedException("Provide a valid authorization token header")
      );
    }

    const bearer = authToken.split(" ")[0];

    if (bearer !== "Bearer")
      return next(
        new UnauthorizedException("Provide a valid authorization token header")
      );

    authToken = authToken.split(" ")[1];

    const payload = verifyJWTwithHMAC({
      token: authToken,
      secret: envConfigs.jwt.secret,
    });

    if (!payload)
      return next(new UnauthorizedException("Invalid or expired token"));

    const user = await accountService.findUser({ _id: payload.sub });

    if (!user)
      return next(
        new ForbiddenException("Cannot find this authenticated account")
      );

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 1 * 60 * 60;
    req.payload = {
      sub: user._id.toString(),
      info: user,
      exp: exp,
      iat: now,
    };

    next();
  } catch (e: any) {
    next(new UnauthorizedException(e));
  }
};
