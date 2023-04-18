const crypto = require("crypto");
//const { Buffer } = require("buffer");
var Buffer = require('buffer/').Buffer

export class Aes256gcm {
    readonly ALGO = "aes-256-gcm";
    key: any;
    constructor(key: any) {
        this.key = key; // new Buffer(crypto.randomBytes(32), "utf8");
    }

    // encrypt returns base64-encoded ciphertext
    encrypt(str: any): any {
        // See: e.g. https://csrc.nist.gov/publications/detail/sp/800-38d/final
        const iv = new Buffer(crypto.randomBytes(12), "utf8");
        const cipher = crypto.createCipheriv(this.ALGO, this.key, iv);

        // Hint: Larger inputs (it's GCM, after all!) should use the stream API
        let enc = cipher.update(str, "utf8", "base64");
        enc += cipher.final("base64");
        let hexIV = iv.toString("hex");
        let hexTag = cipher.getAuthTag().toString("hex");
        return [enc, hexIV, hexTag];
    }

    // decrypt decodes base64-encoded ciphertext into a utf8-encoded string
    decrypt(enc: any, _iv: string, _authTag: string): any {
        let iv = new Buffer(_iv, "hex");
        let authTag = new Buffer(_authTag, "hex");
        const decipher = crypto.createDecipheriv(this.ALGO, this.key, iv);
        decipher.setAuthTag(authTag);
        let str = decipher.update(enc, "base64", "utf8");
        str += decipher.final("utf8");
        return str;
    }
}
