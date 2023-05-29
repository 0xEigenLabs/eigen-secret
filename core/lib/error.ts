import { prepareJson } from "./utils";
export const succResp = function(data: any, hasBigInt: boolean = false) {
  if (hasBigInt) {
      data = prepareJson(data);
  }
  return new AppResp({ errno: 0, data: data });
}

export const errResp = function(errno: ErrCode, message: string) {
  return new AppResp({ errno: errno, message: message });
}

/**
 * Error code for a JSON responce.
 *
 * @enum
 */
export enum ErrCode {
  Success = 0,
  Unknown = 1,
  InvalidAuth = 2,
  InvalidInput = 3,
  CryptoError = 4,
  DBCreateError = 5,
  DuplicatedRecordError = 6,
  RecordNotExist = 7,
  InvalidProof = 8,
  CallContractError = 9
}

interface AppRespArgs {
  data?: any;
  errno: ErrCode;
  message?: string;
  isOperational?: boolean;
}

export class AppResp {
  public readonly message: string;
  public readonly data: any;
  public readonly errno: ErrCode;

  constructor(args: AppRespArgs) {
    this.message = args.message || ErrCode[args.errno];
    this.errno = args.errno;
    this.data = args.data || "";
  }

  public get ok() {
      return this.errno === ErrCode.Success;
  }
}

