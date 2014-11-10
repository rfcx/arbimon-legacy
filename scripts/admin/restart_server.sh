#! /bin/sh

serverrestart="forever restart 0"

npm install && bower install && grunt && $serverrestart
