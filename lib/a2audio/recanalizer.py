from a2audio.rec import Rec
from pylab import *
import numpy
import time
from a2pyutils.config import Config

class Recanalizer:
    
    def __init__(self, uri , speciesSurface ,low , high ,columns,tempFolder,logs=None , bucket = 'arbimon2'):
        start_time = time.time()
        self.low = float(low)
        self.high = float(high)
        self.columns = speciesSurface.shape[1]#int(columns)
        self.speciesSurface = speciesSurface
        self.logs = logs
        configuration = Config()
        config = configuration.data()
        if self.logs :
            self.logs.write("configuration time --- seconds ---" + str(time.time() - start_time))
        start_time = time.time()
        self.rec = Rec(uri,tempFolder,config,bucket,logs)
        if self.logs:
            self.logs.write("retrieving recording from bucket --- seconds ---" + str(time.time() - start_time))
        if self.rec.status == 'HasAudioData':
            start_time = time.time()
            self.spectrogram()
            if self.logs:
                self.logs.write("spectrogrmam --- seconds ---" + str(time.time() - start_time))
            start_time = time.time()
            self.featureVector()
            if self.logs:
                self.logs.write("feature vector --- seconds ---" + str(time.time() - start_time))
            self.status = 'Processed'
        else:
            self.status = 'NoData'
            
        self.tempFolder = tempFolder
        
    def getVector(self ):
        return self.distances
    
    def features(self):
        return [numpy.mean(self.distances), (max(self.distances)-min(self.distances)),
                max(self.distances), min(self.distances)
                , numpy.std(self.distances) , numpy.median(self.distances)]
        
    def featureVector(self):
        
        self.distances = []
        currColumns = self.spec.shape[1]
        step = 2
        matrixSurface = self.speciesSurface[self.lowIndex:self.highIndex,:]
        spec = self.spec;
        for j in range(0,currColumns - self.columns,step): 
            subMatrix =  spec[: , j:(j+self.columns)]
            self.distances.append(numpy.linalg.norm(subMatrix  - matrixSurface) )
                
    def spectrogram(self):

        start_time = time.time()
        Pxx, freqs, bins = mlab.specgram(self.rec.original, NFFT=512, Fs=self.rec.sample_rate , noverlap=256)
        dims =  Pxx.shape
        if self.logs:
            self.logs.write("mlab.specgram --- seconds ---" + str(time.time() - start_time))

        i =0
        j = 0
        start_time = time.time()
        while freqs[i] < self.low:
            j = j + 1
            i = i + 1
        
        #calculate decibeles in the passband
        while freqs[i] < self.high:
           # Pxx[i,:] =  10. * np.log10( Pxx[i,:].clip(min=0.0000000001))
            i = i + 1
 
        if i >= dims[0]:
            i = dims[0] - 1
            
        Z= Pxx[j:i,:]
        
        self.highIndex = dims[0]-j
        self.lowIndex = dims[0]-i
        
        if self.lowIndex < 0:
            self.lowIndex = 0
            
        if self.highIndex >= dims[0]:
            self.highIndex = dims[0] - 1
            
        Z = np.flipud(Z)
        if self.logs:
            self.logs.write('logs and flip ---' + str(time.time() - start_time))
        self.spec = Z
    
    def showVectAndSpec(self):
        ax1 = subplot(211)
        plot(self.distances)
        subplot(212, sharex=ax1)
        ax = gca()
        im = ax.imshow(self.spec, None)
        ax.axis('auto')
        show()
        close()
