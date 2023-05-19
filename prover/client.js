var net = require('net');
const fs = require("fs");

var client = new net.Socket();
client.connect(3100, '127.0.0.1', function() {
	console.log('Connected');
  let inputJson = fs.readFileSync("../circuits/main_update_state.input.json");
  let req = {
    method: "prove",
    body:  {
      task_name: "update",
      input_json: inputJson.toString(),
    }
  }
  console.log(req);
  client.write(`${JSON.stringify(req)}\r\n`);
});

client.on('data', function(data) {
	console.log('Received proof and public input: ' + data);
	client.destroy(); // kill client after server's response
});

client.on('close', function() {
	console.log('Connection closed');
});
