import { DataTypes } from "sequelize";

const {sequelize} = require("../api/db");

export default class SMTDb {
    nodesDB: any;
    root: bigint;
    F: any;

    constructor(F: any) {
        this.nodesDB = sequelize.define("KeyValue", {
            key: {
                type: DataTypes.BIGINT,
                allowNull: false
            },
            value: {
                type: DataTypes.BIGINT,
                allowNull: false
            }
        });
        this.root = F.zero;
        this.F = F;
    }

    async getRoot() {
        return this.root;
    }

    _key2str(k: any) {
        const F = this.F;
        const keyS = this.F.toString(k);
        return keyS;
    }

    _normalize(n: any) {
        const F = this.F;
        for (let i=0; i<n.length; i++) {
            n[i] = this.F.e(n[i]);
        }
    }

    async get(key: any) {
        const keyS = this._key2str(key);
        const res = await this.nodesDB.findOne({where: {key: keyS}});
        return res.value;
    }

    async multiGet(keys: any) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            promises.push(this.get(keys[i]));
        }
        return await Promise.all(promises);
    }

    async setRoot(rt: any) {
        this.root = rt;
    }

    async multiIns(inserts: any) {
        for (let i=0; i<inserts.length; i++) {
            const keyS = this._key2str(inserts[i][0]);
            this._normalize(inserts[i][1]);
            await this.nodesDB.create({
                key: keyS,
                value: inserts[i][1]
            })
        }
    }

    async multiDel(dels: any) {
        for (let i=0; i<dels.length; i++) {
            const keyS = this._key2str(dels[i]);
            const res = await this.nodesDB.destroy({
                where: {
                    key: keyS
                }
            }); 
        }
    }
}

