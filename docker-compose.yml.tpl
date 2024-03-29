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
      - {{EIGEN_SERVICE_ADDR}}:server
  server:
    build: .
    environment:
      - NODE_ENV={{NODE_ENV}}
    ports:
      - "{{EIGEN_SERVICE_PORT}}:3000"
    networks:
      - default
    volumes:
      - "./data:/eigen-secret/server/data"
networks:
  default:
    driver: bridge
