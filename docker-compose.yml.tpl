version: "3"

services:
  ui:
    build: ../eigen-secret-ui
    environment:
      - NODE_ENV={{NODE_ENV}}
    ports:
      - "{{EIGEN_SECRET_PORT}}:80"
    networks:
      - default
  proxy:
    build: ./proxy/
    ports:
      - "{{EIGEN_PROXY_PORT}}:8443"
    networks:
      - default
    external_links:
      - {{EIGEN_SERVICE_ADDR}}_1:server
  server:
    build: .
    ports:
      - "{{EIGEN_SERVICE_PORT}}:3000"
    networks:
      - default
    volumes:
      - "./data:/app/data"
networks:
  default:
    driver: bridge
