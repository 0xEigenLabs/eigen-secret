import { formatMessage, prepareJson, normalizeAlias, verifyEOASignature, hasValue, SESSION_DURATION, calcPubKeyPoint } from "./utils";
import { ErrCode } from "./error";
import { BigNumberish, utils } from "ethers";
import { computeEffEcdsaPubInput, verifyEffEcdsaPubInput } from "@personaelabs/spartan-ecdsa";
import { hashPersonalMessage } from "@ethereumjs/util";

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
        // TODO: refactor
        const sig = utils.splitSignature(this.signature);
        const r = BigInt(sig.r);
        const v = BigInt(sig.v);

        let strRawMessage = formatMessage(this.ethAddress, this.timestamp);
        let messageHash = utils.hashMessage(strRawMessage);
        let msgHash = Buffer.from(utils.arrayify(messageHash))
        const circuitPubInput = computeEffEcdsaPubInput(r, v, msgHash);

        /*
        const pubKey = calcPubKeyPoint(this.signature, this.ethAddress, this.timestamp);
        if (pubKey[0] != this.pubKey[0] || pubKey[1] != this.pubKey[1]) {
            throw new Error(this.signature)
        }
        */
        const input = {
            s: BigInt(sig.s),
            T: [circuitPubInput.Tx, circuitPubInput.Ty],
            U: [circuitPubInput.Ux, circuitPubInput.Uy],
            pubKey: [this.pubKey[0], this.pubKey[1]]
        };
        return input;
    };
}
