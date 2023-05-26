# encoding=utf-8
import argparse
import socket
import os
import re

parser = argparse.ArgumentParser(description='Eigen Deploy')
parser.add_argument('--NODE_ENV', type=str, default="preview",
                    help='secret branch')
parser.add_argument('--PORT_OFFSET', type=str, default=0,
                    help='port')

args = parser.parse_args()

dir_path = os.path.dirname(os.path.realpath(__file__))
dir_name = os.path.basename(os.getcwd())

#proxy, secret, eigen_service, fns
init_ports = [8443, 8090, 3000, 8082]
init_tpls = [
#    os.path.join(dir_path, "../proxy/etc/nginx.conf"),
    os.path.join(dir_path, "../docker-compose.yml")
]

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def check_ports():
    i = int(args.PORT_OFFSET)
    if not any(is_port_in_use(ep + i) for ep in init_ports):
        return i;
    return None

def render_tpl(port_offset):
    variables = {
        r"{{NODE_ENV}}": args.NODE_ENV,
        r"{{EIGEN_PROXY_PORT}}": str(init_ports[0] + port_offset),
        r"{{EIGEN_SECRET_PORT}}": str(init_ports[1] + port_offset),
        r"{{EIGEN_SERVICE_PORT}}": str(init_ports[2] + port_offset),
        r"{{EIGEN_FNS_PORT}}": str(init_ports[3] + port_offset),
        r"{{EIGEN_SERVICE_ADDR}}": "{}_server_{}".format(dir_name, str(port_offset)),
        r"{{IAS_SPID}}": "",
        r"{{IAS_KEY}}" : "",
        r"{{RUST_LOG}}": "debug",
        r"{{KMS_KEY_ID}}": "",
        r"{{KMS_CLIENT_ID}}": "",
        r"{{KMS_CLIENT_SK}}": "replace_me",
        r"{{KMS_CLIENT_REGION}}": "replace_me"
    }
    for files in init_tpls:
        with open("{}.tpl".format(files), "r") as sources:
            lines = sources.readlines()
        with open(files, "w") as sources:
            for line in lines:
                for k, v in variables.items():
                    line = line.replace(k, v)
                sources.write(line)

    return True

def main():
    port_offset = check_ports()
    assert port_offset is not None, "Invalid ports"
    assert render_tpl(port_offset), "Invalid tpl or envs"
    print("Render configure done")

if __name__ == "__main__":
    main()
