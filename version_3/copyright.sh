#!/bin/bash
set -eu
set -o pipefail
cd `dirname $0`


process() {
   echo "// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved" > /tmp/file
   tail -n +2 "$1" >> /tmp/file
   mv /tmp/file "$1"
}

for f in "$@"; do
    process "$f"
done
