// Standalone Node.js Healthcheck Script used by Docker and monitoring agents
import http from 'http';

const options = {
  host: '127.0.0.1',
  port: process.env.PORT || 5000,
  path: '/api/v1/health',
  timeout: 5000,
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

request.end();
