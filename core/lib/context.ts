import { formatMessage, prepareJson, normalizeAlias, verifyEOASignature, hasValue, SESSION_DURATION, calcPubKeyPoint } from "./utils";
import { ErrCode } from "./error";
import { utils } from "ethers";
import { splitToRegisters, calculateEffECDSACircuitInput } from "./secp256k1_utils";

export class Context {
    alias: string;
    ethAddress: string;
    timestamp: string;
    signature: string;
    pubKey: bigint[];

    constructor(
        alias: string,
        ethAddress: string,
        timestamp: string,
        signature: string
    ) {
        this.alias = alias;
        this.ethAddress = ethAddress;
        this.timestamp = timestamp;
        this.signature = signature;
        this.pubKey = calcPubKeyPoint(signature, ethAddress, timestamp);
    }

    static deserialize(serialized: string) {
        let obj = JSON.parse(serialized)
        return new Context(
            obj.alias,
            obj.ethAddress,
            obj.timestamp,
            obj.signature
        );
    }

    serialize() {
        return JSON.stringify(prepareJson(this))
    }

    check() {
        if (
            !hasValue(this.alias) ||
            !normalizeAlias(this.alias) ||
            !hasValue(this.signature) ||
            !hasValue(this.timestamp) ||
            !hasValue(this.ethAddress)) {
            return ErrCode.InvalidInput;
        }

        let validAdddr = verifyEOASignature(
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

    toCircuitInput() {
        let strRawMessage = formatMessage(this.ethAddress, this.timestamp);
        let messageHash = utils.hashMessage(strRawMessage);
        let msgHash = Buffer.from(utils.arrayify(messageHash))
        const ecdsaInput = calculateEffECDSACircuitInput(this.signature, msgHash);

        const input = {
            s: ecdsaInput.s,
            T: ecdsaInput.T,
            U: ecdsaInput.U,
            pubKey: [
                splitToRegisters(this.pubKey[0].toString(16)),
                splitToRegisters(this.pubKey[1].toString(16))
            ]
        };
        return input;
    }
}
