#![warn(rust_2018_idioms)]

use plonky::api::{
    aggregation_check, aggregation_prove, aggregation_verify, analyse, calculate_witness,
    export_aggregation_verification_key, export_verification_key, generate_aggregation_verifier,
    generate_verifier, prove, setup, verify,
};

use futures::SinkExt;
use futures::StreamExt;
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::net::SocketAddr;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};
use uuid::Uuid;

use serde::{Deserialize, Serialize};
use tokio_util::codec::{AnyDelimiterCodec, Framed};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let addr = env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:6142".to_string());

    let listener = TcpListener::bind(&addr).await?;

    println!("server running on {}", addr);

    loop {
        // Asynchronously wait for an inbound TcpStream.
        let (stream, addr) = listener.accept().await?;

        // Clone a handle to the `Shared` state for the new connection.
        tokio::spawn(async move {
            if let Err(e) = process(stream, addr).await {
                println!("an error occurred; error = {:?}", e);
            }
        });
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct Request {
    method: String,
    body: Value,
}

/// Prove by Plonk, https://github.com/0xEigenLabs/eigen-zkvm/blob/main/zkit/src/main.rs#L60
#[derive(Debug, Deserialize)]
struct ProveOpt {
    circuit_file: String,
    wasm_file: String,
    input_json: String,
    /// SRS monomial form
    srs_monomial_form: String,
    srs_lagrange_form: Option<String>,
    transcript: String,
    proof_bin: String,
    proof_json: String,
    public_json: String,
}

/// Verify the Plonk proof
#[derive(Debug, Deserialize)]
struct VerifyOpt {
    vk_file: String,
    proof_bin: String,
    /// Transcript can be keccak or rescue, keccak default
    transcript: String,
}

async fn process(stream: TcpStream, addr: SocketAddr) -> Result<(), Box<dyn Error>> {
    // Process incoming messages until our stream is exhausted by a disconnect.
    let codec = AnyDelimiterCodec::new(b"\r\n".to_vec(), b"\r\n".to_vec());
    let mut lines = Framed::new(stream, codec);

    let msg = match lines.next().await {
        Some(Ok(line)) => line,
        // We didn't get a line so we return early here.
        _ => {
            println!("Failed to get username from {}. Client disconnected.", addr);
            return Ok(());
        }
    };

    // json parse
    let req: Request = serde_json::from_slice(&msg).unwrap();
    match req.method.as_str() {
        "prove" => {
            let opt: ProveOpt = serde_json::from_value(req.body).unwrap();
            let mut wtns_temp_file = format!("/tmp/{}.txt", Uuid::new_v4());
            calculate_witness(&opt.wasm_file, &opt.input_json, &wtns_temp_file)?;
            prove(
                &opt.circuit_file,
                &wtns_temp_file,
                &opt.srs_monomial_form,
                None,
                &opt.transcript,
                &opt.proof_bin,
                &opt.proof_json,
                &opt.public_json,
            )?;
            // write back proof and public input
            let proof_json = std::fs::read_to_string(&opt.proof_json)?;
            let proof_value: Value = serde_json::from_str(&proof_json)?;

            let public_json = std::fs::read_to_string(&opt.public_json)?;
            let public_value: Value = serde_json::from_str(&public_json)?;
            let json = Value::Array(vec![proof_value, public_value]);
            lines.send(json.to_string()).await?;
        }
        "verify" => {
            let opt: VerifyOpt = serde_json::from_value(req.body).unwrap();
            verify(&opt.vk_file, &opt.proof_bin, &opt.transcript)?;
            lines.send(true.to_string()).await?;
        }
        _ => {
            println!("Unknown request: {:?}", req);
        }
    }
    Ok(())
}
