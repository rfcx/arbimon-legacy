#! /bin/sh

node_root=`pwd`

while [ '(' ! -f "$node_root/package.json" ')' -a '(' ! "$node_root" = "/" ')' ]; do
    node_root=`dirname "$node_root"`
done

if [ '(' ! -f "$node_root/package.json" ')' ]; then
    echo "fatal: Package root not found. Stopped searching at $node_root"
    exit 1
fi

scriptspath="$node_root/scripts/setup"
for script in `ls "$scriptspath" | awk '/^[0-9]+-/'`; do
    "$scriptspath/$script"
done
