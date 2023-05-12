import { prepareJson } from "./utils";
export const succResp = function(data: any, hasBigInt: boolean = false) {
  if (hasBigInt) {
      data = prepareJson(data);
  }
  return new AppError({ errno: 0, data: data });
}

export const errResp = function(errno: ErrCode, message: string) {
  return new AppError({ errno: errno, message: message });
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

interface AppErrorArgs {
  data?: any;
  errno: ErrCode;
  message?: string;
  isOperational?: boolean;
}

export class AppError {
  public readonly message: string;
  public readonly data: any;
  public readonly errno: ErrCode;

  constructor(args: AppErrorArgs) {
    this.message = args.message || ErrCode[args.errno];
    this.errno = args.errno;
    this.data = args.data || "";
  }
}

