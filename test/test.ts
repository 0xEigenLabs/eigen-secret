const temp = require("temp");
const path = require("path");
const fs = require("fs");

const circom_wasm = require("circom_tester").wasm;

// opts refers to https://github.com/iden3/circom_tester/blob/main/wasm/tester.js#L31
export async function genTempMain(template_file: string, template_name: string,
    publics: string = "", params: any = [], _opt: any, tester: any = circom_wasm) {
  temp.track();

  const temp_circuit = await temp.open({ prefix: template_name, suffix: ".circom" });
  const include_path = path.relative(temp_circuit.path, template_file);
  const params_string = JSON.stringify(params).slice(1, -1);

  let main = "main";
  if (publics.length > 0) {
    main = `main { public [${publics}] }`
  }

  fs.writeSync(temp_circuit.fd, `
pragma circom 2.0.2;
include "${include_path}";
component ${main} = ${template_name} (${params_string});
    `);

  // console.log(temp_circuit.path, fs.readFileSync(temp_circuit.path, "utf8"))
  return tester(temp_circuit.path, _opt);
}

export function genMain(main_circuit_file: string, template_file: string, template_name: string,
    publics: string = "", params: any = []) {
  const include_path = path.parse(template_file).base;
  const params_string = JSON.stringify(params).slice(1, -1);

  let main = "main";
  if (publics.length > 0) {
    main = `main { public [${publics}] }`
  }

  fs.writeFileSync(main_circuit_file, `
pragma circom 2.0.2;
include "${include_path}";
component ${main} = ${template_name} (${params_string});
    `);
}
