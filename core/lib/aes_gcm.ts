const crypto = require("crypto");
const { Buffer } = require("buffer");

const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;
const ALGO = "aes-256-gcm";
export class Aes256gcm {
    private secret: any;
    constructor(secret: any) {
        this.secret = secret; // new Buffer(crypto.randomBytes(32), "utf8");
    }

    private getKey(salt: Buffer) {
        return crypto.pbkdf2Sync(this.secret, salt, 100000, 32, "sha512");
    }

    // encrypt returns base64-encoded ciphertext
    encrypt(text: any): string {
        // See: e.g. https://csrc.nist.gov/publications/detail/sp/800-38d/final
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = this.getKey(salt);
        const cipher = crypto.createCipheriv(ALGO, key, iv);
        // Hint: Larger inputs (it's GCM, after all!) should use the stream API
        const encrypted = Buffer.concat([
            cipher.update(String(text), "utf8"), cipher.final()
        ]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
    }

    // decrypt decodes base64-encoded ciphertext into a utf8-encoded string
    decrypt(cipherData_: string): any {
        const cipherData = Buffer.from(String(cipherData_), "base64");
        const salt = cipherData.slice(0, SALT_LENGTH);
        const iv = cipherData.slice(SALT_LENGTH, TAG_POSITION);
        const tag = cipherData.slice(TAG_POSITION, ENCRYPTED_POSITION);
        const encrypted = cipherData.slice(ENCRYPTED_POSITION);
        const key = this.getKey(salt);
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(encrypted) + decipher.final("utf8");
    }
}
