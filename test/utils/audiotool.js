/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var rewire = require('rewire');

var audiotool = rewire('../../utils/audiotool');
var mock_childProcess = require('../mock_tools/mock_child_process');

var mocks = {
    childProcess : mock_childProcess
};

audiotool.__set__(mocks);


describe('audiotool', function(){
    describe('sox', function(){
        it('Should call sox with the given arguments', function(done){
            mock_childProcess.running=[];
            audiotool.sox(['arg1', 'arg2', 'arg3'], {}, function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1data2');
                stderr.should.equal('err1');
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['arg1', 'arg2', 'arg3']);
            cp.stdout.send('data', 'data1');
            cp.stderr.send('data', 'err1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
        it('Options can be null/falsey', function(done){
            mock_childProcess.running=[];
            audiotool.sox(['arg1', 'arg2', 'arg3'], null, function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1data2');
                stderr.should.equal('err1');
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['arg1', 'arg2', 'arg3']);
            cp.stdout.send('data', 'data1');
            cp.stderr.send('data', 'err1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
        it('Options are optional', function(done){
            mock_childProcess.running=[];
            audiotool.sox(['arg1', 'arg2', 'arg3'], function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1data2');
                stderr.should.equal('err1');
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['arg1', 'arg2', 'arg3']);
            cp.stdout.send('data', 'data1');
            cp.stderr.send('data', 'err1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
        it('stderr2stdout option should mix stderr and stdout streams.', function(done){
            mock_childProcess.running=[];
            audiotool.sox(['arg1', 'arg2', 'arg3'], {stderr2stdout:true}, function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1err1data2');
                stderr.should.equal(stdout);
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['arg1', 'arg2', 'arg3']);
            cp.stdout.send('data', 'data1');
            cp.stderr.send('data', 'err1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
    });
    describe('info', function(){
        it('Should return the info of an audio file.', function(done){
            mock_childProcess.running=[];
            audiotool.info('audiofile.wav', {stderr2stdout:true}, function(code, info){
                code.should.equal(0);
                info.should.deep.equal({
                    bit_rate        : "337k",
                    channels        : 1,
                    duration        : 60,
                    file_size       : "2.52M",
                    input_file      : "audiofile.wav",
                    precision       : 16,
                    sample_encoding : "16-bit FLAC",
                    sample_rate     : 44100,
                    samples         : 2646000
                });
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['--info', 'audiofile.wav']);
            cp.stdout.send('data', 
                "        \n" +
                "Input File     : 'audiofile.wav'\n" +
                "Channels       : 1\n" +
                "Sample Rate    : 44100\n" +
                "Precision      : 16-bit\n" +
                "Duration       : 00:01:00.00 = 2646000 samples = 4500 CDDA sectors\n" +
                "File Size      : 2.52M\n" +
                "Bit Rate       : 337k\n" +
                "Sample Encoding: 16-bit FLAC\n" +
                "\n"
            );
            cp.send('close', 0);
        });        
    });
    describe('transcode', function(){
        it('Should call sox with the proper arguments', function(done){
            mock_childProcess.running=[];
            audiotool.transcode('input.wav', 'output.wav', {sample_rate:10, format:'qwerty', compression:-1, channels:10}, function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1data2');
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal(['--guard', '--magic', '--show-progress', 'input.wav', 
                '-r', 10,
                '-t', 'qwerty',
                '-C', -1,
                '-c', 10,
            'output.wav']);
            cp.stdout.send('data', 'data1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
        it('Options argument is *glasses* optional', function(done){
            async.series([
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.transcode('input.wav', 'output.wav', {}, function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal(['--guard', '--magic', '--show-progress', 'input.wav', 'output.wav']);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                },
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.transcode('input.wav', 'output.wav', function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal(['--guard', '--magic', '--show-progress', 'input.wav', 'output.wav']);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                },
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.transcode('input.wav', 'output.wav', null, function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal(['--guard', '--magic', '--show-progress', 'input.wav', 'output.wav']);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                }
            ], done);
        });
    });
    describe('spectrogram', function(){
        it('Should call sox with the proper arguments', function(done){
            mock_childProcess.running=[];
            audiotool.spectrogram('input.wav', 'output.wav', {maxfreq: 1000, height: 1, width: 1, pixPerSec: 1, quantization: 1, window: 'Hann'}, function(code, stdout, stderr){
                code.should.equal(0);
                stdout.should.equal('data1data2');
                done();
            });
            var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
            cp.command.should.equal('sox');
            cp.args.should.deep.equal([
                "input.wav", "-r", "2k", "-n", "spectrogram", "-r",
                "-y", 1, "-x", 1, "-q", 1, "-w", 'Hann',
                "-lm", "-o", "output.wav"
            ]);
            cp.stdout.send('data', 'data1');
            cp.stdout.send('data', 'data2');
            cp.send('close', 0);
        });
        it('Options argument is *glasses* optional', function(done){
            async.series([
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.spectrogram('input.wav', 'output.wav', {}, function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal([
                        "input.wav", "-n", "spectrogram", "-r",
                        "-y", 256, "-X", 172, "-q", 249,
                        "-lm", "-o", "output.wav"
                    ]);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                },
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.spectrogram('input.wav', 'output.wav', function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal([
                        "input.wav", "-n", "spectrogram", "-r",
                        "-y", 256, "-X", 172, "-q", 249,
                        "-lm", "-o", "output.wav"
                    ]);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                },
                function(next_part){
                    mock_childProcess.running=[];
                    audiotool.spectrogram('input.wav', 'output.wav', null, function(code, stdout, stderr){
                        code.should.equal(0);
                        stdout.should.equal('data1data2');
                        next_part();
                    });
                    var cp = mock_childProcess.running[mock_childProcess.running.length - 1];
                    cp.command.should.equal('sox');
                    cp.args.should.deep.equal([
                        "input.wav", "-n", "spectrogram", "-r",
                        "-y", 256, "-X", 172, "-q", 249,
                        "-lm", "-o", "output.wav"
                    ]);
                    cp.stdout.send('data', 'data1');
                    cp.stdout.send('data', 'data2');
                    cp.send('close', 0);
                }
            ], done);
        });
    });
});
