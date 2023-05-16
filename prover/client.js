var net = require('net');

var client = new net.Socket();
client.connect(3100, '127.0.0.1', function() {
	console.log('Connected');
	client.write('Hello, server! Love, Client. 1111111111111111111111111111111'.repeat(29));
});

client.on('data', function(data) {
	console.log('Received: ' + data);
	client.destroy(); // kill client after server's response
});

client.on('close', function() {
	console.log('Connection closed');
});
