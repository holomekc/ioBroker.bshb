#!/bin/bash
echo "Remove virtual env"
pyenv virtualenv-delete -f github-bootstrap || true
echo "Create virtual env"
pyenv virtualenv 3.12 github-bootstrap
echo "Install dependencies"
pip install -r requirements.txt
