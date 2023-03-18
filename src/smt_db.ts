import { DataTypes, Model } from "sequelize";
import sequelize from "../server/db";

// const { Sequelize, DataTypes } = require('sequelize');
// const sequelize = new Sequelize({
//     dialect: "sqlite",
//     storage: "../data/test.db"
// });

class KeyValueModel extends Model {}

KeyValueModel.init({
    key: {
        type: DataTypes.STRING,
        allowNull: false
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "KeyValueModel"
})


export class SMTDb {
    nodesDB: any;
    root: bigint;
    F: any;

    constructor(F: any) {
        this.nodesDB = KeyValueModel
        this.root = F.zero;
        this.F = F;
    }

    async init() {
        await this.nodesDB.sync({force:true});
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
        if (res === null) {
            console.log("not found", res)
        } else {
            console.log(res.value);
        }
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
            
            let transaction: any;
            try {
                transaction = await sequelize.transaction();
                let found = await KeyValueModel.findOne({
                    where:{
                        key: keyS
                    }
                });
                console.log("found:", found)

                if (found === null) {
                    let res = await KeyValueModel.create({
                        key: keyS,
                        value: this.F.toString(inserts[i][1])
                    }, {
                        transaction
                    });
                }
                await transaction.commit();
            } catch (err: any) {
                if (transaction) {
                    transaction.rollback();
                }
            }
        }
    }

    async multiDel(dels: any) {
        for (let i=0; i<dels.length; i++) {
            const keyS = this._key2str(dels[i]);
            let transaction: any;
            try {
                transaction = await sequelize.transaction();
                let found = await KeyValueModel.findOne({
                    where:{
                        key: keyS
                    }
                });
                console.log("found:", found)
        
                if (found !== null) {
                    let res = KeyValueModel.destroy({
                        where: {
                            key: keyS
                        }, 
                        transaction
                    })
                } else {
                    console.log("Not found", keyS);
                }
                await transaction.commit();
            } catch (err: any) {
                if (transaction) {
                    transaction.rollback();
                }
            }
        }
    }
}