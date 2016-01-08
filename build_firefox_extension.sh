#!/bin/bash

set -eu -o pipefail

echo "Build firefox webextension"

cd webextension/
zip -r ../webextension.xpi *

echo "Done"