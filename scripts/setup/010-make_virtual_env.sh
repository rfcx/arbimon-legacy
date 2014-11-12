#! /bin/sh

envdir=".env"
cur_dir=`pwd`
node_root=`pwd`

while [ '(' ! -f "$node_root/package.json" ')' -a '(' ! "$node_root" = "/" ')' ]; do
    node_root=`dirname "$node_root"`
done

if [ '(' ! -f "$node_root/package.json" ')' ]; then
    echo "fatal: Package root not found. Stopped searching at $node_root"
    exit 1
fi

envpath="$node_root/$envdir"
requirementspath="$node_root/requirements.txt"
creating="creating"

echo "Creating virtual environment in :  $envpath"

if [ -d "$envpath" ]; then
    echo "$envpath already exists."
    printf "Do you want to re-create the virtual environment? (yes/no) : "
    read recreate
    while [ ! '(' "$recreate" = "yes" -o "$recreate" = "no" ')' ]; do
        printf "            (yes/no) : "
        read recreate
    done
    
    if [ "$recreate" = "yes" ]; then
        creating="re-creating"
        echo "Cleaning up current virtual environment..."
        rm -rf $envpath
    else
        echo "Leaving current virtual environment as is."
        exit
    fi
        
fi

if virtualenv $envpath; then
    if [ -f "$requirementspath" ]; then
        echo "Installing dependencies from $requirementspath"
        "$envpath/bin/pip" install -r "$requirementspath"
    else
        echo "Not installing dependencies since no requirements file was found in $node_root"
    fi

    echo "Done $creating virtual environment."
    
    echo "Remember to source $envdir/bin/activate to use the virtual envioronment."
    
else
    echo "Error while $creating virtual environment, exiting."
    exit 1
fi
