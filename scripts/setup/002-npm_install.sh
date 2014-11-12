#! /bin/sh

cur_dir=`pwd`
node_root="$cur_dir"

while [ '(' ! -f "$node_root/package.json" ')' -a '(' ! "$node_root" = "/" ')' ]; do
    node_root=`dirname "$node_root"`
done

if [ '(' ! -f "$node_root/package.json" ')' ]; then
    echo "fatal: Package root not found. Stopped searching at $node_root"
    exit 1
fi

cd "$node_root"

npm install

cd "$cur_dir"
