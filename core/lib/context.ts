import { normalizeAlias, verifyEOASignature, hasValue, SESSION_DURATION } from "./utils";
import { ErrCode } from "./error";
export class Context {
    alias: string;
    ethAddress: string;
    rawMessage: string;
    timestamp: string;
    signature: string;

    constructor(
        alias: string,
        ethAddress: string,
        rawMessage: string,
        timestamp: string,
        signature: string
    ) {
        this.alias = alias;
        this.ethAddress = ethAddress;
        this.rawMessage = rawMessage;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    static deserialize(serialized: string) {
        let obj = JSON.parse(serialized)
        return new Context(
            obj.alias,
            obj.ethAddress,
            obj.rawMessage,
            obj.timestamp,
            obj.signature
        );
    }

    serialize() {
        return JSON.stringify(this)
    }

    check() {
        if (
            !hasValue(this.alias) ||
            !normalizeAlias(this.alias) ||
            !hasValue(this.signature) ||
            !hasValue(this.rawMessage) ||
            !hasValue(this.timestamp) ||
            !hasValue(this.ethAddress)) {
            return ErrCode.InvalidInput;
        }

        let validAdddr = verifyEOASignature(
            this.rawMessage,
            this.signature,
            this.ethAddress,
            this.timestamp
        );
        if (!validAdddr) {
            return ErrCode.InvalidInput;
        }
        let expireAt = Math.floor(Date.now() / 1000);
        if (Number(this.timestamp) + SESSION_DURATION <= expireAt) {
            return ErrCode.InvalidAuth;
        }
        return ErrCode.Success;
    }
}
