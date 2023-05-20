use plonky::api::{
    aggregation_check, aggregation_prove, aggregation_verify, analyse, calculate_witness,
    export_aggregation_verification_key, export_verification_key, generate_aggregation_verifier,
    generate_verifier, prove, setup, verify,
};

use std::env;
use std::net::SocketAddr;
use uuid::Uuid;

use rocket::serde::json::{Json, Value, json};
use rocket::serde::{Serialize, Deserialize};

#[macro_use] extern crate rocket;
use std::io;

#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let _rocket = rocket::build()
        .mount("/update_state", routes![handle_update_state])
        .mount("/withdraw", routes![handle_withdraw])
        .mount("/hello", routes![index])
        .launch()
        .await?;

    Ok(())
}

/// Prove by Plonk, https://github.com/0xEigenLabs/eigen-zkvm/blob/main/zkit/src/main.rs#L60
#[derive(Debug, Clone, FromForm, Serialize, Deserialize)]
struct ProveOpt {
    #[serde(default)]
    circuit_file: String,
    #[serde(default)]
    wasm_file: String,
    input_json: String,
    /// SRS monomial form
    #[serde(default)]
    srs_monomial_form: String,
    srs_lagrange_form: Option<String>,
    #[serde(default)]
    transcript: String,
    #[serde(default)]
    proof_bin: String,
    #[serde(default)]
    proof_json: String,
    #[serde(default)]
    public_json: String,
    #[serde(default)]
    witness: String,
    #[serde(default)]
    input_json_file: String,
}

fn make_prove_opt_for_update(workspace: &str, opt: &mut ProveOpt) {
    opt.circuit_file = format!("../circuits/main_update_state_js/main_update_state.r1cs");
    opt.wasm_file = format!("../circuits/main_update_state_js/main_update_state.wasm");
    opt.srs_monomial_form = format!("../circuits/setup_2^18.key");
    opt.srs_lagrange_form = None;
    opt.transcript = "keccak".to_string();
    let uuid = Uuid::new_v4();
    opt.proof_bin = format!("{}/{}.proof.bin", workspace, uuid);
    opt.proof_json = format!("{}/{}.proof.json", workspace, uuid);
    opt.public_json = format!("{}/{}.public.json", workspace, uuid);
    opt.input_json_file = format!("{}/{}.input.json", workspace, uuid);
    opt.witness = format!("{}/{}.wtns", workspace, uuid);
}

fn make_prove_opt_for_withdraw(workspace: &str, opt: &mut ProveOpt) {
    opt.circuit_file = format!("../circuits/main_withdraw_js/main_withdraw.r1cs");
    opt.wasm_file = format!("../circuits/main_withdraw_js/main_withdraw.wasm");
    opt.srs_monomial_form = format!("../circuits/setup_2^18.key");
    opt.srs_lagrange_form = None;
    opt.transcript = "keccak".to_string();
    let uuid = Uuid::new_v4();
    opt.proof_bin = format!("{}/{}.proof.bin", workspace, uuid);
    opt.proof_json = format!("{}/{}.proof.json", workspace, uuid);
    opt.public_json = format!("{}/{}.public.json", workspace, uuid);
    opt.input_json_file = format!("{}/{}.input.json", workspace, uuid);
    opt.witness = format!("{}/{}.wtns", workspace, uuid);
}

/// Verify the Plonk proof
#[derive(Serialize, Deserialize)]
struct VerifyOpt {
    vk_file: String,
    proof_bin: String,
    /// Transcript can be keccak or rescue, keccak default
    transcript: String,
}

#[catch(404)]
fn not_found() -> Value {
    json!({
        "status": "error",
        "reason": "Resource was not found."
    })
}

#[post("/", format = "json", data = "<opt>")]
fn handle_update_state(opt: Json<ProveOpt>) -> Value {
    let mut opt = opt.into_inner();
    make_prove_opt_for_update("/tmp", &mut opt);
    std::fs::write(std::path::Path::new(&opt.input_json_file), opt.input_json.clone()).unwrap();
    calculate_witness(&opt.wasm_file, &opt.input_json_file, &opt.witness).unwrap();
    prove(
        &opt.circuit_file,
        &opt.witness,
        &opt.srs_monomial_form,
        None,
        &opt.transcript,
        &opt.proof_bin,
        &opt.proof_json,
        &opt.public_json,
    ).unwrap();
    // write back proof and public input
    let proof_json = std::fs::read_to_string(&opt.proof_json).unwrap();
    let proof_value: Value = serde_json::from_str(&proof_json).unwrap();

    let public_json = std::fs::read_to_string(&opt.public_json).unwrap();
    let public_value: Value = serde_json::from_str(&public_json).unwrap();
    let json = Value::Array(vec![proof_value, public_value]);
    json
}

#[post("/", format = "json", data = "<opt>")]
fn handle_withdraw(opt: Json<ProveOpt>) -> Value {
    let mut opt = opt.into_inner();
    make_prove_opt_for_update("/tmp", &mut opt);
    std::fs::write(std::path::Path::new(&opt.input_json_file), opt.input_json.clone()).unwrap();
    calculate_witness(&opt.wasm_file, &opt.input_json_file, &opt.witness).unwrap();
    prove(
        &opt.circuit_file,
        &opt.witness,
        &opt.srs_monomial_form,
        None,
        &opt.transcript,
        &opt.proof_bin,
        &opt.proof_json,
        &opt.public_json,
    ).unwrap();
    // write back proof and public input
    let proof_json = std::fs::read_to_string(&opt.proof_json).unwrap();
    let proof_value: Value = serde_json::from_str(&proof_json).unwrap();

    let public_json = std::fs::read_to_string(&opt.public_json).unwrap();
    let public_value: Value = serde_json::from_str(&public_json).unwrap();
    let json = Value::Array(vec![proof_value, public_value]);
    json
}
