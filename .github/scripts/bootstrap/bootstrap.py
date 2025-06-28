import os
import subprocess
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from github import Auth
from github import Github as PyGithub

from lib.console import console

FATAL = "[red]⚠[/]"

OWNER = "holomekc"
REPO = "ioBroker.bshb"
GITHUB_TOKEN = os.getenv('GH_COM_TOKEN4')
if not GITHUB_TOKEN:
    console.print(FATAL)
    console.print("[red]Environment variable GITHUB_TOKEN is not set. Stopping.[/]")
    exit(1)

pg = PyGithub(auth=Auth.Token(GITHUB_TOKEN))

def prepare_deploy_key():
    console.print('[blue]Create SSH key...[/]')
    repository = pg.get_repo(f"{OWNER}/{REPO}")

    console.print('... generate private key')
    # Generate a private key
    private_key = ec.generate_private_key(ec.SECP521R1())

    # Serialize the private key in PEM format
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode("utf-8")

    console.print('... generate public key')
    # Generate the corresponding public key
    public_key = private_key.public_key()

    # Serialize the public key in OpenSSH format
    public_key_ssh = public_key.public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH
    ).decode("utf-8")

    keys = repository.get_keys()
    for key in keys:
        if key.title == 'SSH_KEY':
            console.print('... delete old deploy key')
            key.delete()

    console.print('... store public key as deploy key')
    repository.create_key('SSH_KEY', public_key_ssh, False)
    console.print('... store private key as secret')
    repository.create_secret('SSH_KEY', private_key_pem)

    console.print('... store known hosts as secret')
    command = 'ssh-keyscan -t ecdsa github.com'
    known_hosts = subprocess.check_output(command, shell=True, text=True)
    repository.create_secret('SSH_KNOWN_HOSTS', known_hosts)
    console.print("")


if __name__ == '__main__':
    prepare_deploy_key()
    # Close the connection to GitHub via PyGithub again
    pg.close()
