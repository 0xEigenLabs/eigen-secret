use plonky::api::{
    aggregation_check, aggregation_prove, aggregation_verify, analyse,
    export_aggregation_verification_key, export_verification_key, generate_aggregation_verifier,
    generate_verifier, prove, setup, verify,
};

use std::env;
use std::net::{self, SocketAddr};
use std::thread;


use tokio::net::TcpStream;
use std::time;
use tokio::sync::mpsc;

use futures::FutureExt;

fn main() {
    // First argument, the address to bind
    let addr = env::args().nth(1).unwrap_or("127.0.0.1:3100".to_string());
    println!("{}", addr);
    let addr = addr.parse::<SocketAddr>().unwrap();

    // Second argument, the number of threads we'll be using
    let num_threads = env::args().nth(2).and_then(|s| s.parse().ok())
        .unwrap_or(num_cpus::get()/4);

    // Use `std::net` to bind the requested port, we'll use this on the main
    // thread below
    let listener = net::TcpListener::bind(&addr).expect("failed to bind");
    println!("Listening on: {}", addr);

    // Spin up our worker threads, creating a channel routing to each worker
    // thread that we'll use below.
    let mut channels = Vec::new();
    for _ in 0..num_threads {
        let (tx, rx) = mpsc::unbounded_channel();
        channels.push(tx);
        thread::spawn(|| worker(rx));
    }

    // Infinitely accept sockets from our `std::net::TcpListener`, as this'll do
    // blocking I/O. Each socket is then shipped round-robin to a particular
    // thread which will associate the socket with the corresponding event loop
    // and process the connection.
    let mut next = 0;
    for socket in listener.incoming() {
        let socket = socket.expect("failed to accept");
        channels[next].send(socket).expect("worker thread died");
        next = (next + 1) % channels.len();
    }
}

fn worker(mut rx: mpsc::UnboundedReceiver<net::TcpStream>) {
    let ten_millis = time::Duration::from_millis(500);
    loop {
        let mut buffer = String::new();
        rx.read_to_string(&mut buffer).expect("Unable to read from buffer");
        s.push_str(&buffer);
    }
}
