use plonky::api::{
    aggregation_check, aggregation_prove, aggregation_verify, analyse,
    export_aggregation_verification_key, export_verification_key, generate_aggregation_verifier,
    generate_verifier, prove, setup, verify,
};

extern crate futures;
extern crate num_cpus;
extern crate tokio_core;
extern crate tokio_io;

use std::env;
use std::net::{self, SocketAddr};
use std::thread;

use futures::Future;
use futures::stream::Stream;
use futures::sync::mpsc;
use tokio_io::AsyncRead;
use tokio_io::io::copy;
use tokio_core::net::TcpStream;
use tokio_core::reactor::Core;

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
        let (tx, rx) = mpsc::unbounded();
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
        channels[next].unbounded_send(socket).expect("worker thread died");
        next = (next + 1) % channels.len();
    }
}

fn worker(rx: mpsc::UnboundedReceiver<net::TcpStream>) {
    let mut core = Core::new().unwrap();
    let handle = core.handle();

    let done = rx.for_each(move |socket| {
        // First up when we receive a socket we associate it with our event loop
        // using the `TcpStream::from_stream` API. After that the socket is not
        // a `tokio_core::net::TcpStream` meaning it's in nonblocking mode and
        // ready to be used with Tokio
        let socket = TcpStream::from_stream(socket, &handle)
            .expect("failed to associate TCP stream");
        let addr = socket.peer_addr().expect("failed to get remote address");

        // Like the single-threaded `echo` example we split the socket halves
        // and use the `copy` helper to ship bytes back and forth. Afterwards we
        // spawn the task to run concurrently on this thread, and then print out
        // what happened afterwards
        let (reader, writer) = socket.split();
        let amt = copy(reader, writer);
        let msg = amt.then(move |result| {
            println!("{:?}", result);
            match result {
                Ok((amt, _, _)) => println!("wrote {} bytes to {}", amt, addr),
                Err(e) => println!("error on {}: {}", addr, e),
            }

            Ok(())
        });
        handle.spawn(msg);

        Ok(())
    });
    core.run(done).unwrap();
}
