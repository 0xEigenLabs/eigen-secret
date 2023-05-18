var net = require('net');

var client = new net.Socket();
client.connect(3100, '127.0.0.1', function() {
	console.log('Connected');

  let req = {
    method: "prove",
    body:  {
      circuit_file: "../circuits/main_update_state_js/main_update_state.r1cs",
      witness: "../circuits/main_update_state_js/witness.wtns",
      srs_monomial_form: "/tmp/final.zkay.18",
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
	console.log('Received: ' + data);
	client.destroy(); // kill client after server's response
});

client.on('close', function() {
	console.log('Connection closed');
});
