var net = require('net');

var client = new net.Socket();
client.connect(3100, '127.0.0.1', function() {
	console.log('Connected');

  let req = {
    method: "prove",
    body:  {
      circuit_file: "../circuits/main_update_state_js/main_update_state.r1cs",
      wasm_file: "../circuits/main_update_state_js/main_update_state.wasm",
      input_json: "../circuits/main_update_state.input.json",
      srs_monomial_form: "/tmp/setup_2^18.key",
      srs_lagrange_form: "",
      transcript: "keccak",
      proof_bin: "/tmp/proof.bin",
      proof_json: "/tmp/proof.json",
      public_json: "/tmp/public.json",
    }
  }

  client.write(`${JSON.stringify(req)}\r\n`);
});

client.on('data', function(data) {
	console.log('Received proof and public input: ' + data);
	client.destroy(); // kill client after server's response
});

client.on('close', function() {
	console.log('Connection closed');
});
