#!/bin/bash
major=$(echo "${1}" | cut -d. -f1)
minor=$(echo "${1}" | cut -d. -f2)

echo "Update minor tag: ${major}.${minor}"
git tag "${major}.${minor}" --force
git push origin "${major}.${minor}" --force

echo "Update major tag: ${major}"
git tag "${major}" --force
git push origin "${major}" --force
