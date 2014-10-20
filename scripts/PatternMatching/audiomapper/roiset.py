from pylab import *
import numpy

class Roiset:   

    def __init__(self, classId,setSRate):
        self.classId = classId
        self.roiCount = 0
        self.roi = [] 
        self.sampleLengths =[]
        self.rows = 0
        self.sampleRates = []
        self.setSampleRate = setSRate
        
    def addRoi(self,lowFreq,highFreq,sample_rate,spec,rows,columns):
        if self.setSampleRate == sample_rate:
            if len(self.sampleLengths) < 1:
                self.maxColumns = columns
                self.varlengthsIndeces = []
                self.maxIndeces = []
                self.maxrois = []
                self.varlengths = set()
                self.maxrois.append(spec)
                self.maxIndeces.append(self.roiCount)
                self.lowestFreq = lowFreq
                self.highestFreq = highFreq  
            else:
                if self.lowestFreq > lowFreq:
                    self.lowestFreq = lowFreq
                if self.highestFreq < highFreq:
                    self.highestFreq = highFreq
                if self.maxColumns < columns:
                    self.varlengths.add(self.maxColumns)
                    self.maxColumns = columns
                    for i in self.maxIndeces:
                        self.varlengthsIndeces.append(i)
                    self.maxIndeces = []
                    self.maxIndeces.append(self.roiCount)
                    self.maxrois = []
                    self.maxrois.append(spec)
                elif self.maxColumns == columns:
                    self.maxIndeces.append(self.roiCount)
                    self.maxrois.append(spec)
                else:
                    self.varlengthsIndeces.append(self.roiCount)
                    self.varlengths.add(columns)
                    
            self.sampleRates.append(sample_rate)    
            self.sampleLengths.append(columns)
            self.rows = rows
            self.roi.append(Roi(lowFreq,highFreq,sample_rate,spec)) 
            self.roiCount = self.roiCount + 1     

    def alignSamples(self):

        self.surface = numpy.sum(self.maxrois,axis=0)
        self.surface = self.surface/len(self.maxIndeces)

        for i in self.varlengthsIndeces:
            distances = []
            currColumns = self.roi[i].spec.shape[1]
            for j in range(self.maxColumns -currColumns ): 
                subMatrix =  self.surface[:, j:(j+currColumns)]
                distances.append(numpy.linalg.norm(subMatrix  - self.roi[i].spec) )
            j = distances.index(min(distances))
            temp = numpy.zeros(shape=(self.rows,self.maxColumns))
            temp[:, j:(j+currColumns)] = self.roi[i].spec
            self.maxrois.append(temp)
            self.surface[:, j:(j+currColumns)] = (self.surface[:, j:(j+currColumns)] + self.roi[i].spec)/2

        self.meanSurface = numpy.mean([self.maxrois[j] for j in range(self.roiCount)],axis=0)
        self.stdSurface = numpy.std([self.maxrois[j] for j in range(self.roiCount)],axis=0)

    def showSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.surface, None)
        ax1.axis('auto')
        show()
        close()

    def showMeanSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.meanSurface, None)
        ax1.axis('auto')
        show()
        close()

    def showStdSurface(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.stdSurface, None)
        ax1.axis('auto')
        show()
        close()

class Roi:

    def __init__(self,lowFreq,highFreq,sample_rate,spec):
        self.lowFreq = lowFreq
        self.highFreq = highFreq
        self.sample_rate = sample_rate
        self.spec = spec

    def showRoi(self):
        ax1 = subplot(111)
        im = ax1.imshow(self.spec, None)
        ax1.axis('auto')
        show()
        close()

