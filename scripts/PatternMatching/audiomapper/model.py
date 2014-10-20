
from sklearn.ensemble import RandomForestClassifier
from sklearn import metrics
from sklearn.preprocessing import normalize
import numpy
import cPickle as pickle
from itertools import izip as zip, count
import random

class Model:

    def __init__(self,classid,speciesSpec):
        self.classid = classid
        self.speciesSpec = speciesSpec
        self.data  = numpy.zeros(shape=(0,6))
        self.classes = []
        
    def addSample(self,present,meanfeat,difffeat,maxfeat,minfeat,stdfeat,medfeat):
        self.classes.append(present)
        row = [meanfeat,difffeat,maxfeat,minfeat,stdfeat,medfeat]
        self.data = numpy.vstack((self.data,row))
    
    def splitData(self,useTrainingPresent,useTrainingNotPresent,useValidationPresent,useValidationNotPresent):
        self.splitParams = [useTrainingPresent,useTrainingNotPresent,useValidationPresent,useValidationNotPresent]

        presentIndeces = [i for i, j in zip(count(), self.classes) if j == '1']
        notPresentIndices = [i for i, j in zip(count(), self.classes) if j == '0']
        
        if(len(presentIndeces) < (useTrainingPresent+useValidationPresent)):
            return False
        if(len(notPresentIndices) < (useTrainingNotPresent+useValidationNotPresent)):
            return False
          
        random.shuffle(presentIndeces)
        random.shuffle(notPresentIndices)
        
        self.trainDataIndices = presentIndeces[:useTrainingPresent] + notPresentIndices[:useTrainingNotPresent]
        self.validationDataIndices = presentIndeces[useTrainingPresent:] + notPresentIndices[useTrainingNotPresent:]
        
        return True
        
    def train(self):
        self.clf = RandomForestClassifier(n_estimators=1000,n_jobs=-1,oob_score=True) #min_samples_leaf
        
        classSubset = [self.classes[i] for i in self.trainDataIndices]
        self.clf.fit(self.data[self.trainDataIndices], classSubset)
        self.obbScore = self.clf.oob_score_
        
    def validate(self):
        classSubset = [self.classes[i] for i in self.validationDataIndices]
        predictions = self.clf.predict(self.data[self.validationDataIndices])
        self.accuracy_score = 0.0
        for i in range(len(classSubset)):
            if classSubset[i] == predictions[i]:
                self.accuracy_score = self.accuracy_score + 1.0
        self.accuracy_score = float(self.accuracy_score)/float(len(classSubset))
        
        index0 = 1
        index1 = 0
        if self.clf.classes_[0] == '0':
            index0 = 0
            index1 = 1
        self.precision_score = metrics.precision_score(classSubset,predictions,labels=self.clf.classes_, pos_label=index0,average=None )
        self.precision_score = (self.precision_score[0] + self.precision_score[1])/2.0
        self.recall_score = metrics.recall_score(classSubset,predictions,labels=self.clf.classes_ , pos_label=index0 ,average=None)
        self.recall_score = (self.recall_score[0]+self.recall_score[1])/2.0
    
    def modelStats(self):
        #smin = min([min((self.speciesSpec[i])) for i in range(self.speciesSpec.shape[0])])
        #smax = max([max((self.speciesSpec[i])) for i in range(self.speciesSpec.shape[0])])
        #x = 255*((self.speciesSpec - smin)/(smax-smin))
        return [self.accuracy_score,self.precision_score,self.recall_score,self.obbScore,self.speciesSpec]
    
    def save(self,filename,l,h,c):
        with open(filename, 'wb') as output:
            pickler = pickle.Pickler(output, -1)
            pickle.dump([self.clf,self.speciesSpec,l,h,c], output, -1)
        