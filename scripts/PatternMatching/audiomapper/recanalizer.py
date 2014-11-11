from plotter import Plotter
from rec import Rec
from pylab import *
import numpy
from config import Config

class Recanalizer:
    
    def __init__(self, uri , speciesSurface ,low , high ,columns,tempFolder , bucket = 'arbimon2'):
        self.low = float(low)
        self.high = float(high)
        self.columns = speciesSurface.shape[1]#int(columns)
        self.speciesSurface = speciesSurface
        configuration = Config()
        config = configuration.data()
        self.rec = Rec(uri,tempFolder,config,bucket)
        self.spectrogram()
        self.featureVector()
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
        for j in range(currColumns - self.columns): 
            subMatrix =  self.spec[:, j:(j+self.columns)]
            self.distances.append(numpy.linalg.norm(subMatrix  - self.speciesSurface) )
                
    def spectrogram(self):

        data = self.rec.original
        Pxx, freqs, bins = mlab.specgram(data, NFFT=512, Fs=self.rec.sample_rate , noverlap=256)
        dims =  Pxx.shape
        
        #put zeros in unwanted frequencies (filter)
        i =0
        while freqs[i] < self.low:
            Pxx[i,:] = 0 
            i = i + 1
        
        #calculate decibeles in the passband
        while freqs[i] < self.high:
            Pxx[i,:] =  10. * np.log10( Pxx[i,:].clip(min=0.0000000001))
            i = i + 1
        #put zeros in unwanted frequencies (filter)
        while i <  dims[0]:
            Pxx[i,:] = 0
            i = i + 1

        Z = np.flipud(Pxx)
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
