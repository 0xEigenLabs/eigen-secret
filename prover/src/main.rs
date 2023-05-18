#![warn(rust_2018_idioms)]

use plonky::api::{
    aggregation_check, aggregation_prove, aggregation_verify, analyse,
    export_aggregation_verification_key, export_verification_key, generate_aggregation_verifier,
    generate_verifier, prove, setup, verify,
};

use std::env;
use std::collections::HashMap;
use futures::StreamExt;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use std::error::Error;

use tokio_util::codec::{AnyDelimiterCodec, Framed};
use serde::{Deserialize, Serialize};

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
    body: serde_json::Value,
}


/// Prove by Plonk, https://github.com/0xEigenLabs/eigen-zkvm/blob/main/zkit/src/main.rs#L60
#[derive(Debug, Deserialize)]
struct ProveOpt {
    circuit_file: String,
    witness: String,
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


async fn process(
        stream: TcpStream,
        addr: SocketAddr,
    ) -> Result<(), Box<dyn Error>> {
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
    println!("msg: {:?}", msg);
    let req: Request = serde_json::from_slice(&msg).unwrap();
    match req.method.as_str() {
        "prove" => {
            let opt: ProveOpt = serde_json::from_value(req.body).unwrap();
            prove(
                &opt.circuit_file,
                &opt.witness,
                &opt.srs_monomial_form,
                None,
                &opt.transcript,
                &opt.proof_bin,
                &opt.proof_json,
                &opt.public_json
            )?;
        },
        "verify" => {
            let opt: VerifyOpt = serde_json::from_value(req.body).unwrap();
            verify(
                &opt.vk_file,
                &opt.proof_bin,
                &opt.transcript
            )?
        }
        _ => {
            println!("Unknown request: {:?}", req);
        }
    }
    Ok(())
}
